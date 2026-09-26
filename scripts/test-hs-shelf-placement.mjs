import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { adjustableShelfCount, shelfTowerFixedShelves } from '../src/shelfCounts.js';
import { buildDetailedReachInParts, buildDetailedWalkInParts } from '../src/partList.js';
function extract(source, name) {
 const start = source.indexOf(`function ${name}(`);
 assert.ok(start >= 0);
 return source.slice(start, source.indexOf('\n}', start) + 2);
}
for (const file of ['src/App.jsx', 'src/walkin.jsx']) {
 const walk=file.includes('walkin');
 const name=walk?'buildWalkInTowerLayout':'buildTowerLayout';
 const source=fs.readFileSync(file,'utf8');
 const context=vm.createContext({adjustableShelfCount,shelfTowerFixedShelves,panelThickness:0.75,toeKickHeight:5});
 vm.runInContext(['buildAdjustableShelves','buildDrawers','getDrawerBounds',name].map(n=>extract(source,n)).join('\n'),context);
 for(const height of [84,96]) for(const width of [18,24,30]) {
  const layout=walk?context[name](height,'HS'):context[name]({height},{code:'HS',width,bayX:0});
  const shelves=[...layout.shelves].sort((a,b)=>a.y-b.y);
  assert.equal(shelves[0].fixed,false);
  assert.equal(shelves.at(-2).fixed,true);
  assert.equal(shelves.at(-1).fixed,true);
  assert.equal(shelves.filter(s=>s.fixed).length,2);
  assert.equal(shelves.filter(s=>!s.fixed).length,height===84?3:4);
  assert.ok(shelves.at(-2).y < layout.rods[0].y);
  const modules=[{code:'DH',width},{code:'HS',width}];
  const parts=walk?buildDetailedWalkInParts({height},{back:modules}):buildDetailedReachInParts(modules,height);
  const fixed=parts.find(p=>p.sku===`FS-${width}-14-W`);
  const adjustable=parts.find(p=>p.sku===`SH-${width}-14-W`);
  assert.equal(fixed.quantity,4);
  assert.equal(adjustable.quantity,height===84?4:6);
  assert.match(fixed.details,/directly below the hanging section/);
  assert.match(adjustable.details,/including the bottom shelf/);
 }
}
console.log('HS placement and mixed-tower BOM checks passed for both planners, both heights and all widths.');
