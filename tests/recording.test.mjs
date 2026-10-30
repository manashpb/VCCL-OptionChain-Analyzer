import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Store} from '../src/store.mjs';
import {session,minutesDue,dayAt,stamp,validate} from '../src/market.mjs';
import {Recorder} from '../src/recorder.mjs';
test('IST schedule is inclusive, bounded and skips weekends',()=>{
 const start=Date.parse('2026-10-30T09:15:00+05:30');assert.equal(minutesDue(start-1).length,0);assert.equal(minutesDue(start).length,1);
 assert.equal(minutesDue(Date.parse('2026-10-30T16:00:00+05:30')).length,286);assert.equal(minutesDue(Date.parse('2026-10-31T12:00:00+05:30')).length,0);
 assert.equal(dayAt(Date.parse('2026-10-30T00:00:00+05:30')),'2026-10-30');
});
test('validation rejects wrong expiry/date; flags stale rather than inventing timestamps',()=>{
 const minute=Date.parse('2026-10-30T09:15:00+05:30');
 const payload={snapshot:{k:['s','exp','dt','ts','uv'],v:['nifty','3-Nov-2026','30-Oct-2026',minute-300000,22000]},strikes:{k:['sp','cOI'],v:[[22000,123]]}};
 assert.equal(validate(payload,minute,'3-Nov-2026').quality,'stale_or_out_of_window');assert.throws(()=>validate(payload,minute,'10-Nov-2026'));
 payload.snapshot.v[3]=minute-86400000;assert.throws(()=>validate(payload,minute,'3-Nov-2026'));
});
test('SQLite deduplicates minutes, replaces stale records and purges old days',()=>{
 const folder=mkdtempSync(path.join(os.tmpdir(),'oc-store-')),store=new Store(path.join(folder,'test.db'));
 try{
  const minute=session().start,record={requested_at:stamp(minute),observed_at:stamp(minute),quality:'stale_or_out_of_window',spot:22000,normalized:{strikes:[{sp:22000,cOI:2,pOI:3}]}};
  store.save(minute,'3-Nov-2026',record,'historical');store.save(minute,'3-Nov-2026',{...record,quality:'near_requested_time'},'live');store.save(minute,'3-Nov-2026',record,'historical');
  assert.ok(store.freshness().lastSavedAt);assert.equal(store.freshness().latestSnapshotAt,record.observed_at);assert.equal(store.read()[0].records.length,1);assert.equal(store.read()[0].records[0].quality,'near_requested_time');
  store.save(minute,'3-Nov-2026',{...record,quality:'near_requested_time',spot:23000},'live','NIFTY-AI');
  assert.equal(store.read().length,2);assert.equal(store.read(dayAt(),'NIFTY-AI')[0].records[0].spot,23000);assert.equal(store.read(dayAt(),'NIFTY')[0].records[0].spot,22000);
  assert.equal(store.saved(dayAt(),'NIFTY-AI').size,1);assert.ok(store.freshness(dayAt(),'NIFTY-AI').lastSavedAt);
  store.db.prepare('INSERT INTO snapshots(day,minute,expiry,quality,source,payload) VALUES(?,?,?,?,?,?)').run('2000-01-01',1,'old','bad','historical',Buffer.from('old'));
  store.purge();assert.equal(store.db.prepare('SELECT count(*) n FROM snapshots').get().n,2);assert.throws(()=>store.save(minute-86400000,'old',record,'live'));
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});
test('recorder prioritizes live minute, then backfills and does not refetch valid minute',async()=>{
 const {start}=session(),now=start+120000+10000,saved=new Map(),calls=[];
 const expiry=dayAt();const fake={purge(){},saved(){return saved;},save(minute,exp,record,source){saved.set(minute,record.quality);calls.push({minute,source});}};
 const payload=minute=>({snapshot:{k:['s','exp','dt','ts','uv'],v:['NIFTY',expiry,dayAt(),minute,22000]},strikes:{k:['sp','cOI'],v:[[22000,100]]}});
 const aoc={async expiries(){return [expiry];},async live(){return payload(start+120000);},async historical(e,m){return payload(m);}};
 // Use a weekday on the current day; scheduler is tested above for weekend dates.
 if(!session().weekday)return;
 const recorder=new Recorder(fake,aoc);await recorder.tick(now);await recorder.tick(now+1000);await recorder.tick(now+2000);
 assert.deepEqual(calls.map(c=>c.source),['live','historical','historical']);assert.equal(new Set(calls.map(c=>c.minute)).size,3);
});
