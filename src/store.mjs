import {DatabaseSync} from 'node:sqlite';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {dayAt,stamp,session} from './market.mjs';
export class Store{
 constructor(file){mkdirSync(path.dirname(file),{recursive:true});this.db=new DatabaseSync(file);this.revision=0;
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS snapshots(day TEXT NOT NULL,minute INTEGER PRIMARY KEY,expiry TEXT NOT NULL,quality TEXT NOT NULL,source TEXT NOT NULL,payload BLOB NOT NULL); CREATE INDEX IF NOT EXISTS snapshots_day ON snapshots(day,minute);');
  if(!this.db.prepare('PRAGMA table_info(snapshots)').all().some(c=>c.name==='updated_at'))this.db.exec('ALTER TABLE snapshots ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
 }
 freshness(day=dayAt()){
  const latest=this.db.prepare("SELECT minute,payload FROM snapshots WHERE day=? AND quality='near_requested_time' ORDER BY minute DESC LIMIT 1").get(day);
  const write=this.db.prepare('SELECT max(updated_at) updated FROM snapshots WHERE day=? AND quality=\'near_requested_time\'').get(day);
  return {latestSnapshotAt:latest?JSON.parse(gunzipSync(latest.payload).toString()).observed_at:null,lastSavedAt:write.updated?stamp(write.updated):null};
 }
 purge(day=dayAt()){
  const n=this.db.prepare('DELETE FROM snapshots WHERE day<>?').run(day).changes;
  if(n){this.db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');this.revision++;}
 }
 save(minute,expiry,record,source){if(dayAt(minute)!==dayAt())throw Error('Only current-day records may be stored');
  this.db.prepare('INSERT INTO snapshots(day,minute,expiry,quality,source,payload,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(minute) DO UPDATE SET expiry=excluded.expiry,quality=excluded.quality,source=excluded.source,payload=excluded.payload,updated_at=excluded.updated_at WHERE snapshots.quality<>\'near_requested_time\'').run(dayAt(minute),minute,expiry,record.quality,source,gzipSync(JSON.stringify(record)),Date.now());this.revision++;
 }
 saved(day=dayAt()){return new Map(this.db.prepare('SELECT minute,quality FROM snapshots WHERE day=?').all(day).map(r=>[r.minute,r.quality]));}
 read(day=dayAt()){
  const rows=this.db.prepare('SELECT * FROM snapshots WHERE day=? ORDER BY minute').all(day);if(!rows.length)return [];
  const expiry=rows[0].expiry;
  const byMinute=new Map(rows.map(row=>[row.minute,row]));
  const start=session(rows[0].minute).start,last=rows.at(-1).minute;
  const timeline=Array.from({length:Math.floor((last-start)/60000)+1},(_,i)=>start+i*60000);
  return [{date:day,expiry,symbol:'NIFTY',records:timeline.map(minute=>{
   const row=byMinute.get(minute);if(!row)return {requested_at:stamp(minute),observed_at:null,quality:'missing',spot:null,strikes:[]};
   const r=JSON.parse(gunzipSync(row.payload).toString());
   return {requested_at:stamp(row.minute),observed_at:r.observed_at,quality:r.quality,spot:r.spot,source:row.source,strikes:r.normalized.strikes.map(s=>Object.fromEntries(['sp','cVol','pVol','cOI','pOI','cOIC','pOIC'].map(k=>[k,s[k]])))};
  })}];
 }
 close(){this.db.close();}
}
