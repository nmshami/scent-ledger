import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',style:{},dataset:{},classList:{toggle(){},contains(){return false}},focus(){},scrollIntoView(){},addEventListener(){},setAttribute(){},removeAttribute(){},getAttribute(){return 'false'}});return elements.get(id);};
const context={console,URL,Set,Date,Blob,setTimeout,clearTimeout,localStorage:{getItem(){return '[]'}},document:{getElementById:el,querySelector:()=>el('skip'),querySelectorAll:()=>[],title:''},location:{hash:'#library'},window:{addEventListener(){},scrollTo(){}},fetch:()=>new Promise(()=>{})};
vm.createContext(context);vm.runInContext(fs.readFileSync('web/app.js','utf8'),context);
context.raw=fs.readFileSync('web/assets/records.json','utf8');
vm.runInContext('records=validateRecords(JSON.parse(raw));',context);
const records=JSON.parse(context.raw);
assert.equal(records.length,8);
for(const record of records){
 assert(record.editorial_context?.length>180,'Missing useful context: '+record.id);
 assert(record.context_source?.startsWith('https://'),'Missing context source');
 if(record.image_file)assert(fs.existsSync('web/assets/'+record.image_file));
 context.location.hash='#fragrance/'+record.id;vm.runInContext('render()',context);
 assert(el('main').innerHTML.includes('Understanding the composition'));
 assert(!el('main').innerHTML.includes('/assets/null'));
 context.recordId=record.id;
 const linked=vm.runInContext('connections(records.find(r=>r.id===recordId))',context);
 for(const link of linked){assert(link.record.id!==record.id);assert(link.reasons.length);}
}
context.bad=JSON.stringify({...records[0],context_source:'javascript:alert(1)'});
assert.throws(()=>vm.runInContext('validateRecords([JSON.parse(bad)])',context));
console.log('PASS: eight editorial sections, valid source links, existing local images, truthful related-record connections and unsafe editorial URL rejection. Not a browser visual test.');
