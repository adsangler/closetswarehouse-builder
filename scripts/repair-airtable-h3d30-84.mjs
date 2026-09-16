import assert from 'node:assert/strict';
import {loadEnv} from 'vite';
import {fetchAirtableRecords} from '../api/_airtable.js';
Object.assign(process.env,loadEnv('production',process.cwd(),''));
const [kits,parts,rows]=await Promise.all(['kits','parts','kitParts'].map(fetchAirtableRecords));
const sku='H3D-32-84-14-W';
const source=kits.find(k=>k.fields.shopify_sku==='H3D-26-84-14-W');
const tall=kits.find(k=>k.fields.shopify_sku==='H3D-32-96-14-W');
assert.ok(source && tall);
const byId=new Map(parts.map(p=>[p.id,p]));
const bySku=new Map(parts.map(p=>[p.fields['Item Code'],p]));
const bom=rows.filter(r=>r.fields.Kits?.includes(source.id)).map(r=>{
 const code=byId.get(r.fields.Part[0]).fields['Item Code'].replace('-24-','-30-');
 const part=bySku.get(code); assert.ok(part,code);
 assert.ok(Number(part.fields.retail_price)>0,code);
 return {part,code,qty:Number(r.fields['Quantity Needed Per Kit'])};
});
assert.equal(bom.length,11);
const tallBom=new Map(rows.filter(r=>r.fields.Kits?.includes(tall.id)).map(r=>[byId.get(r.fields.Part[0]).fields['Item Code'].replace('-96-','-84-'),Number(r.fields['Quantity Needed Per Kit'])]));
for(const b of bom) assert.equal(b.qty,tallBom.get(b.code)-(b.code==='SH-30-14-W'?1:0),b.code);
const sum=key=>Math.round(bom.reduce((n,b)=>n+Number(b.part.fields[key]||0)*b.qty,0)*100)/100;
const fields={ 'Kit Name':sku, shopify_sku:sku, shopify_handle:sku.toLowerCase(), KitID:'K5-30', Status:'Active', Height:84, Width:31.5, Depth:14, 'Width Requirement':33.5, nominal_width_in:30, tower_count:1, has_drawers:true, has_hanging:true, color:'White', product_type:'Single Tower', config_label:'Hang & Drawers', ceiling_height:'Standard (8ft)', Description:'Hang & 3 Drawer Tower – 31.5"W × 84"H × 14"D', retail_price:sum('retail_price'), 'Total Cost':sum('Total Cost'), weight_lbs:sum('weight_lbs') };
console.log(JSON.stringify({sku,fields,bom:bom.map(b=>({part:b.code,qty:b.qty})),verifiedAgainstTallKit:true},null,2));
if(!process.argv.includes('--apply'))process.exit(0);
async function request(table,path,method,body){
 const r=await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}${path}`,{method,headers:{Authorization:`Bearer ${process.env.AIRTABLE_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return data;
}
let kit=kits.find(k=>k.fields.shopify_sku===sku);
if(!kit)kit=await request(process.env.AIRTABLE_KITS_TABLE,'','POST',{fields:{...fields,Status:'Draft'}});
const existing=rows.filter(r=>r.fields.Kits?.includes(kit.id));
const missing=bom.filter(b=>!existing.some(r=>r.fields.Part?.includes(b.part.id)));
for(let i=0;i<missing.length;i+=10){await request(process.env.AIRTABLE_KIT_PARTS_TABLE,'','POST',{records:missing.slice(i,i+10).map(b=>({fields:{Kits:[kit.id],Part:[b.part.id],'Quantity Needed Per Kit':b.qty,Notes:`${b.code} × ${b.qty} for ${sku}`}}))});}
await request(process.env.AIRTABLE_KITS_TABLE,`/${kit.id}`,'PATCH',{fields});
console.log(JSON.stringify({created:kit.id,sku,price:fields.retail_price,bomRows:bom.length}));
