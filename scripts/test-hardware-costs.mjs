import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildResolvedParts} from '../api/_part-pricing.js';

test('Rafix component costs override stale direct cost without replacing explicit retail',()=>{
 const data={parts:[{id:'pack',fields:{'Item Code':'CAMKIT-10-W','Total Cost':0.05,retail_price:7.5}}],
 components:[{id:'housing',fields:{'Component Name':'housing',Cost:0.2697}},{id:'bolt',fields:{'Component Name':'bolt',Cost:0.1573}}],
 partComponents:['housing','bolt'].map(id=>({fields:{Part:['pack'],Component:[id],'Component Quantity':10}}))};
 const result=buildResolvedParts(data)[0].resolved;
 assert.equal(result.cost,4.27);
 assert.equal(result.costSource,'components');
 assert.equal(result.price,7.5);
 data.components[0].fields.Cost=0.3;
 assert.equal(buildResolvedParts(data)[0].resolved.cost,4.57);
});

test('toe-kick includes eight euro screws and preserves non-hardware pricing behavior',()=>{
 const data={parts:[{id:'toe',fields:{'Item Code':'TKK-24-5-W','Total Cost':5.3,retail_price:9.32}}],
 components:[{id:'board',fields:{Cost:3.98}},{id:'bracket',fields:{Cost:0.6}},{id:'screw',fields:{Cost:0.02}}],
 partComponents:[['board',1],['bracket',2],['screw',8]].map(([id,q])=>({fields:{Part:['toe'],Component:[id],'Component Quantity':q}}))};
 assert.equal(buildResolvedParts(data)[0].resolved.cost,5.34);
 data.parts[0].fields['Item Code']='OTHER';
 assert.equal(buildResolvedParts(data)[0].resolved.cost,5.3);
});
