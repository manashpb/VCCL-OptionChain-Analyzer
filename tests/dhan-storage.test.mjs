import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.mjs';
import {dayAt,stamp} from '../src/market.mjs';

test('Dhan preserves two samples per minute, ignores duplicate acquisitions, and marks real outages',()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'dhan-storage-'));
 const store=new Store(path.join(tmp,'test.sqlite3'));
 const start=Date.parse(dayAt()+'T09:15:00+05:30');
 const save=(at,oi)=>store.save(at,'03-Nov-2026',{requested_at:stamp(at),observed_at:stamp(at),
  quality:'near_requested_time',spot:100,normalized:{snapshot:{uv:100},strikes:[{sp:100,cOI:oi}]}},'dhan-live');
 try{
  save(start,10);save(start+35000,20);save(start+70000,30);
  let records=store.read()[0].records;
  assert.equal(records.length,3);assert.equal(records[1].strikes[0].cOI,20);
  assert.equal(Date.parse(records[1].requested_at),start+35000);
  const revision=store.revision;save(start+70000,999);assert.equal(store.revision,revision);
  save(start+200000,40);records=store.read()[0].records;
  assert.equal(records.filter(r=>r.quality==='missing').length,1);
  assert.equal(records.at(-1).strikes[0].cOI,40);
 }finally{store.close();rmSync(tmp,{recursive:true,force:true});}
});
