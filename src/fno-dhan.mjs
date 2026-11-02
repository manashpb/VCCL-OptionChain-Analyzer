// Dhan credentials and network pacing remain owned by the FNO backend.
export class FnoDhan {
 constructor(base='http://127.0.0.1:8001'){
  const url=new URL(base);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('FNO bridge must use a loopback HTTP origin');
  this.base=url.origin;
 }
 async live(symbol='NIFTY'){
  if(symbol!=='NIFTY')throw Error('Dhan recorder supports NIFTY only');
  const response=await fetch(this.base+'/api/optionchain/live?ticker=NIFTY',{signal:AbortSignal.timeout(35000)});
  if(!response.ok){
   const body=await response.json().catch(()=>({}));
   const error=Error('Dhan collection paused: '+(body.code||'HTTP '+response.status));
   error.auth=body.code==='PROVIDER_AUTH_ERROR';
   error.retryAfter=Math.max(60,Number(response.headers.get('retry-after'))||0);
   throw error;
  }
  return response.json();
 }
}
