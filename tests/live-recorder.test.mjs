import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveRecorder} from '../src/live-recorder.mjs';
const base=Date.parse('2026-11-02T10:00:00+05:30');
function fixture(){
 const saves=[];let calls=0,now=base;
 const store={purge(){},saved(){return new Map(saves.map((s,i)=>[i,s]));},save(...args){saves.push(args);}};
 const provider={async live(){calls++;return {source:'dhan',timestamp_kind:'snapshot-acquisition',refreshed_at:new Date(now).toISOString(),snapshot:{s:'NIFTY',exp:'03-Nov-2026',uv:100},strikes:[{sp:100,cOI:10,pOI:20}]};}};
 const recorder=new LiveRecorder(store,provider,{random:()=>0.5,now:()=>now});
 return {recorder,saves,provider,calls:()=>calls,time:t=>now=t};
}
test('one Dhan sample per 30–40 seconds, with no catch-up or after-hours traffic',async()=>{
 const f=fixture();await f.recorder.tick(base);await f.recorder.tick(base+1000);
 assert.equal(f.calls(),1);assert.equal(f.recorder.nextAt,base+35000);
 f.time(base+35000);await f.recorder.tick(base+35000);
 assert.equal(f.saves[1][0],base+35000); // Preserve a second sample within the same minute.
 f.time(base+3600000);await f.recorder.tick(base+3600000);
 assert.equal(f.calls(),3);assert.equal(f.saves.length,3);assert.equal(f.saves[0][3],'dhan-live');
 await f.recorder.tick(Date.parse('2026-11-02T16:00:00+05:30'));assert.equal(f.calls(),3);
});
test('errors back off and authentication failure stops collection',async()=>{
 const f=fixture();f.provider.live=async()=>{throw Error('unavailable');};
 await f.recorder.tick(base);assert.equal(f.recorder.state.status,'backing-off');
 assert.equal(f.recorder.nextAt,base+125000);assert.equal(f.saves.length,0);
 f.provider.live=async()=>{throw Object.assign(Error('auth'),{auth:true});};
 await f.recorder.tick(base+200000);assert.equal(f.recorder.state.status,'authentication-paused');
 f.provider.live=async()=>{assert.fail('must not retry authentication');};
 await f.recorder.tick(base+3600000);
});
test('stale or other-provider snapshots remain gaps',async()=>{
 const f=fixture();f.time(base-3600000);await f.recorder.tick(base);
 assert.equal(f.saves.length,0);assert.equal(f.recorder.state.status,'backing-off');
});
