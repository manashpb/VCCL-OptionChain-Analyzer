import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyze,metrics} from '../public/analytics.mjs';
async function launch(auth){
 const fixture=mkdtempSync(path.join(os.tmpdir(),'optionchain-test-'));
 const folder=path.join(fixture,'2026-10-29','NIFTY','3-Nov-2026');mkdirSync(folder,{recursive:true});
 const records=[0,1].map(i=>({requested_at:`2026-10-29T09:${15+i}:00+05:30`,observed_at:`2026-10-29T09:${15+i}:00+05:30`,quality:i?'near_requested_time':'stale_or_out_of_window',normalized:{snapshot:{uv:22500},strikes:[1,2,3,4].map(n=>({sp:22400+n*50,cOI:n,pOI:5-n,cOIC:n,pOIC:5-n,cVol:n,pVol:5-n}))}}));
 records.forEach((r,i)=>writeFileSync(path.join(folder,i+'.json'),JSON.stringify(r)));writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({records:records.map((_,i)=>({file:i+'.json'}))}));
 const port=19000+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,OPTIONCHAIN_ARCHIVE_DIR:fixture,OPTIONCHAIN_REPLAY:'1',OPTIONCHAIN_PORT:String(port),OPTIONCHAIN_WORKSPACE_AUTH:auth?'1':'0',PORTAL_PORT:'1'},stdio:'pipe'});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});
 child.once('exit',()=>rmSync(fixture,{recursive:true,force:true}));
 return {child,url:`http://127.0.0.1:${port}/optionchain/`};
}
test('archive API, assets, secret isolation and real-data bounds',async()=>{
 const {child,url}=await launch(false);
 try{
  const csp=(await fetch(url)).headers.get('content-security-policy');assert.ok(csp.includes("script-src 'self'"));assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"));
  for(const route of ['', 'app.mjs','analytics.mjs','style.css','plotly.min.js'])assert.equal((await fetch(url+route)).status,200);
  for(const route of ['aoctoken.txt','server.mjs','data/2026-10-29','../aoctoken.txt'])assert.equal((await fetch(url+route)).status,404);
  assert.equal((await fetch(url+'api/data',{method:'POST'})).status,405);
  const sets=await(await fetch(url+'api/data')).json();assert.ok(sets[0].records.length>0);
  for(const metric of metrics)for(const side of ['c','p']){
   const out=analyze(sets[0].records,metric.id,side);
   assert.equal(out.series.length,4);assert.deepEqual(out.series.map(x=>x.strike),out.series.map(x=>x.strike).sort((a,b)=>b-a));
   for(const line of out.series){assert.equal(line.points[0].pct,null);for(const p of line.points)assert.ok(p.pct===null||(p.pct>=0&&p.pct<=100));}
   assert.equal(out.series.find(x=>x.strike===out.leader).points.at(-1).pct,100);
  }
 }finally{child.kill();}
});
test('workspace mode fails closed without login verifier',async()=>{
 const {child,url}=await launch(true);
 try{assert.equal((await fetch(url+'api/data')).status,503);assert.equal((await fetch(url)).status,503);}finally{child.kill();}
});
