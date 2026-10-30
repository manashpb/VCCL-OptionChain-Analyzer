import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Store} from './src/store.mjs';
import {Aoc} from './src/aoc.mjs';
import {FnoAoc} from './src/fno-aoc.mjs';
import {Recorder} from './src/recorder.mjs';
import {dayAt} from './src/market.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.OPTIONCHAIN_PORT||5005);
const workspace=process.env.OPTIONCHAIN_WORKSPACE_AUTH==='1';
const prefix='/optionchain/';
async function dataset(){
  const base=process.env.OPTIONCHAIN_ARCHIVE_DIR||path.join(root,'data'); const sets=[];
  for(const day of await readdir(base)) {
    const nifty=path.join(base,day,'NIFTY');
    try{for(const expiry of await readdir(nifty)){
      const folder=path.join(nifty,expiry);
      const manifest=JSON.parse(await readFile(path.join(folder,'manifest.json'),'utf8'));
      const records=await Promise.all(manifest.records.map(async entry=>{
        const r=JSON.parse(await readFile(path.join(folder,entry.file),'utf8'));
        return {requested_at:r.requested_at,observed_at:r.observed_at,quality:r.quality,spot:r.normalized.snapshot.uv,strikes:r.normalized.strikes.map(s=>Object.fromEntries(['sp','cVol','pVol','cOI','pOI','cOIC','pOIC'].map(k=>[k,s[k]])))};
      }));
      sets.push({date:day,expiry,symbol:'NIFTY',records});
    }}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return sets.sort((a,b)=>b.date.localeCompare(a.date));
}
const replay=process.env.OPTIONCHAIN_REPLAY==='1';
const data=replay?await dataset():null;
const store=replay?null:new Store(process.env.OPTIONCHAIN_DB||path.join(root,'data','current-day.sqlite3'));
store?.purge();
const provider=process.env.FNO_AOC_BRIDGE==='1'?new FnoAoc(process.env.FNO_AOC_URL||'http://127.0.0.1:8001'):new Aoc(process.env.AOC_TOKEN_FILE||path.join(root,'aoctoken.txt'));
const recorders=replay?{}:Object.fromEntries(['NIFTY','NIFTY-AI'].map(symbol=>[symbol,new Recorder(store,provider,symbol)]));
if(process.env.OPTIONCHAIN_RECORD!=='0')for(const recorder of Object.values(recorders))recorder.start();
let cacheKey='',cacheBody='';
function currentData(){if(replay)return JSON.stringify(data);store.purge();const key=dayAt()+':'+store.revision;if(key!==cacheKey){cacheBody=JSON.stringify(store.read());cacheKey=key;}return cacheBody;}
const assets=new Map([['','index.html'],['app.mjs','app.mjs'],['analytics.mjs','analytics.mjs'],['style.css','style.css']]);
export const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Cache-Control','no-store');
  try{
    if(workspace){
      let auth;
      try{auth=await fetch('http://127.0.0.1:'+Number(process.env.PORTAL_PORT||5001)+'/verify',{headers:{Cookie:req.headers.cookie||''},signal:AbortSignal.timeout(4000)});}catch{res.writeHead(503);return res.end('Workspace login service unavailable');}
      if(auth.status!==204){res.writeHead(401);return res.end('Sign in to the shared workspace.');}
    }
    if(req.method!=='GET'){res.writeHead(405);return res.end();}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/optionchain'){res.writeHead(302,{Location:prefix});return res.end();}
    const route=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):url.pathname.slice(1);
    if(route==='api/data'){res.setHeader('Content-Type','application/json');return res.end(currentData());}
    if(route==='api/status'){const symbol=url.searchParams.get('symbol')||'NIFTY';if(!['NIFTY','NIFTY-AI'].includes(symbol)){res.writeHead(400);return res.end('Invalid symbol');}const recorder=recorders[symbol];res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(replay?{status:'replay',mode:'replay'}:{...recorder.state,...store.freshness(dayAt(),symbol),symbol,mode:'current-day',day:dayAt(),schedule:'09:15-14:00 IST',retention:'Current IST day only'}));}
    let file=assets.get(route),type=file?.endsWith('.css')?'text/css':file?.endsWith('.mjs')?'text/javascript':'text/html';
    if(route==='plotly.min.js'){file='../node_modules/plotly.js-dist-min/plotly.min.js';type='text/javascript';}
    if(!file){res.writeHead(404);return res.end('Not found');}
    res.setHeader('Content-Type',type+'; charset=utf-8');
    res.end(await readFile(path.join(root,'public',file)));
  }catch{res.writeHead(500);res.end('Unable to load local archive');}
});
server.listen(port,'127.0.0.1',()=>console.log(`OptionChain Analyzer: http://127.0.0.1:${port}/optionchain/ (${workspace?'workspace authentication':'local preview'})`));

for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const recorder of Object.values(recorders))recorder.stop();server.close(()=>{store?.close();process.exit(0);});});
