// Reuse FNO Analyzer's configured AOC client and token. Credentials never leave FNO.
export class FnoAoc{
 constructor(base='http://127.0.0.1:8001'){
  const url=new URL(base);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('FNO bridge must use a loopback HTTP origin');
  this.base=url.origin;this.cooldown=0;
 }
 async request(route,params){
  if(Date.now()<this.cooldown)throw Error('AOC rate-limit cooldown');
  const url=new URL(this.base+route);for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(response.status===429){this.cooldown=Date.now()+60000;throw Error('AOC rate limit; FNO collection paused');}
  if(!response.ok)throw Error('AOC via FNO temporarily unavailable (HTTP '+response.status+'); check FNO Token Sync');
  return response.json();
 }
 async expiries(){const p=await this.request('/api/expiries',{ticker:'NIFTY'});return p.expiries??[];}
 historical(expiry,minute){return this.request('/api/historical',{ticker:'NIFTY',expiry,timestamp:minute});}
 live(){return this.request('/api/data',{ticker:'NIFTY'});}
}
