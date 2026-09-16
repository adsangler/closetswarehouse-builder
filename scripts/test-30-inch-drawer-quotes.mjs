import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeQuoteSubmission,validateNormalizedQuote} from '../api/_quote-normalize.js';
for(const height of [84,96])test(`30-inch drawer towers survive quote normalization at ${height} inches`,()=>{
 const modules=['S3D','H3D','S2D'].map((code,index)=>({code,width:30,index,wall:'left'}));
 const q=normalizeQuoteSubmission({height,modules,customer:{email:'test@example.com'},estimatedPrice:1000});
 assert.equal(q.modules.length,3);
 assert.deepEqual(q.modules.map(m=>[m.code,m.width]),modules.map(m=>[m.code,m.width]));
 assert.equal(validateNormalizedQuote(q),'');
});
test('18-inch drawer towers remain invalid',()=>{
 const q=normalizeQuoteSubmission({modules:[{code:'H3D',width:18}],customer:{email:'test@example.com'}});
 assert.equal(q.modules.length,0);
 assert.equal(validateNormalizedQuote(q),'At least one closet tower is required.');
});
