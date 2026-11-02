import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const SERVERS=['https://v27.aoccalculator.in/api/v27/','https://v27.niftychain.in/api/v27/'];
export class Aoc{
 constructor(tokenFile){this.tokenFile=tokenFile;this.last=0;this.cooldown=0;this.blocked=null;this.fingerprint='';this.activeServer=SERVERS[0];this.failedServers=new Map();}
 async fetchServer(endpoint,params,token){
  const servers=[this.activeServer,...SERVERS.filter(s=>s!==this.activeServer)].filter(s=>(this.failedServers.get(s)||0)<=Date.now());
  if(!servers.length)throw Error('AOC servers temporarily unavailable; retry shortly');
  for(const [index,server]of servers.entries()){
   if(index){await new Promise(r=>setTimeout(r,Math.max(0,2000-(Date.now()-this.last))));this.last=Date.now();}
   const url=new URL(server+endpoint);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
   let response;
   try{response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json',Origin:'https://aoccalculator.in',Referer:'https://aoccalculator.in/'},signal:AbortSignal.timeout(20000)});}
   catch{this.failedServers.set(server,Date.now()+300000);if(index+1<servers.length)continue;throw Error('AOC servers could not be reached');}
   if(response.status>=500){this.failedServers.set(server,Date.now()+300000);if(index+1<servers.length){await response.body?.cancel();continue;}}
   else{this.activeServer=server;this.failedServers.delete(server);}
   return response;
  }
 }
 async request(endpoint,params={}){
  let contents;try{contents=await readFile(this.tokenFile,'utf8');}catch{throw Error('AOC token file unavailable');}
  const token=contents.trim().replace(/^Bearer\s+/i,'');
  if(!token)throw Error('AOC token is missing');
  const fingerprint=createHash('sha256').update(token).digest('hex');
  if(fingerprint!==this.fingerprint){this.blocked=null;this.fingerprint=fingerprint;}
  if(this.blocked)throw Error(this.blocked);
  if(Date.now()<this.cooldown)throw Error('AOC rate-limit cooldown');
  await new Promise(r=>setTimeout(r,Math.max(0,2000-(Date.now()-this.last))));this.last=Date.now();
  const response=await this.fetchServer(endpoint,params,token);
  if([401,403].includes(response.status)){this.blocked='AOC authentication failed; update the token file';throw Error(this.blocked);}
  if(response.status===429){const h=response.headers.get('retry-after'),numeric=Number(h);this.cooldown=Date.now()+Math.max(60000,Number.isFinite(numeric)?numeric*1000:(Date.parse(h)-Date.now()||60000));throw Error('AOC rate limit; collection paused');}
  if(!response.ok)throw Error('AOC returned HTTP '+response.status);
  const payload=await response.json();if(payload.statusCode&&payload.statusCode!==200)throw Error('AOC rejected the request');return payload;
 }
 expiries(symbol='NIFTY'){return this.request('get-expiry-dates',{ticker:symbol});}
 historical(expiry,minute,symbol='NIFTY'){return this.request('historical-data',{ticker:symbol,expiry,timestamp:minute});}
 live(symbol='NIFTY'){return this.request('live-data',{symbol,cacheBust:Date.now()});}
}
