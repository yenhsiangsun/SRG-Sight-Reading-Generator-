// Download pinned public audio assets only; verify each Git blob hash before caching.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const plan=JSON.parse(await fs.readFile(new URL('./western-samples-plan.json',import.meta.url),'utf8'));
const root=path.resolve('western-sources.local');
await fs.mkdir(root,{recursive:true});
let index=0,complete=0;
async function worker(){
 while(index<plan.length){
  const item=plan[index++],file=path.join(root,item.blob+'.'+item.kind);
  if(!/^[a-f0-9]{40}$/.test(item.blob))throw Error('Invalid asset hash');
  let data=await fs.readFile(file).catch(()=>null);
  const hash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
  if(!data||hash(data)!==item.blob){
   const url=`https://raw.githubusercontent.com/${item.repo}/${item.revision}/${item.path.split('/').map(encodeURIComponent).join('/')}`;
   const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error(`${response.status}: ${item.path}`);
   data=Buffer.from(await response.arrayBuffer());
   if(hash(data)!==item.blob)throw Error(`Checksum failed: ${item.path}`);
   await fs.writeFile(file,data);
  }
  complete++; if(complete%25===0)console.log(`${complete}/${plan.length}`);
 }
}
await Promise.all(Array.from({length:5},worker));
console.log(`Verified ${complete} source samples.`);
