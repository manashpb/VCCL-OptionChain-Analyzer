import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {FnoAoc} from '../src/fno-aoc.mjs';
import {validate,dayAt} from '../src/market.mjs';
test('shared FNO adapter forwards exact AOC routes without credentials and preserves full chains',async()=>{
 const minute=Math.floor(Date.now()/60000)*60000,seen=[],expiry=dayAt();
 const chain={snapshot:{s:'NIFTY',exp:expiry,dt:expiry,ts:minute,uv:22000},strikes:Array.from({length:80},(_,i)=>({sp:20000+i*50,cOI:i,pOI:i}))};
 const server=createServer((req,res)=>{seen.push(req);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url.startsWith('/api/expiries')?{expiries:[expiry]}:chain));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const client=new FnoAoc(`http://127.0.0.1:${server.address().port}`);
  assert.deepEqual(await client.expiries(),[expiry]);
  assert.equal(validate(await client.live(),minute,expiry).normalized.strikes.length,80);
  assert.equal(validate(await client.historical(expiry,minute),minute,expiry).quality,'near_requested_time');
  assert.equal(seen[1].url,'/api/data?ticker=NIFTY');
  assert.equal(seen[2].url,`/api/historical?ticker=NIFTY&expiry=${expiry}&timestamp=${minute}`);
  for(const req of seen)assert.equal(req.headers.authorization,undefined);
  assert.throws(()=>new FnoAoc('https://example.com'));
 }finally{await new Promise(r=>server.close(r));}
});
