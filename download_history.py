"""Download minute NIFTY chains using the existing FNO-Analyzer AOC transport."""
import sys,json,hashlib
from pathlib import Path
from copy import deepcopy
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'FNO-Analyzer'/'src'))
from fno_analyzer.config import DEFAULTS
from fno_analyzer.providers.aoc import AocClient,parse_payload
from fno_analyzer.services.oi_downloader import expiry_date,snapshot_time

def main():
    settings=deepcopy(DEFAULTS)
    settings['providers']['aoc'].update(api_mode='v27',token=(ROOT/'aoctoken.txt').read_text().strip())
    client=AocClient(settings)
    start=datetime(2026,10,29,9,15,tzinfo=ZoneInfo('Asia/Kolkata'))
    expiries=client.get_expiries('NIFTY')
    expiry=min((e for e in expiries if expiry_date(e)>=start.date()),key=expiry_date)
    print('Selected expiry:',expiry,flush=True)
    out=ROOT/'data'/'2026-10-29'/'NIFTY'/expiry
    out.mkdir(parents=True,exist_ok=True)
    (out/'expiries.json').write_text(json.dumps(expiries,indent=2))
    records=[]
    for i in range(361):
        requested=start+timedelta(minutes=i)
        path=out/(requested.strftime('%H%M')+'.json')
        if path.exists():
            record=json.loads(path.read_text())
            payload=record['raw']
        else:
            payload=client.fetch_historical('NIFTY',expiry,int(requested.timestamp()*1000))
        data=parse_payload(payload)
        observed=snapshot_time(data['snapshot'])
        snap=data['snapshot']
        if not data['strikes'] or str(snap.get('s','')).upper()!='NIFTY' or expiry_date(snap.get('exp'))!=expiry_date(expiry) or expiry_date(snap.get('dt'))!=start.date() or observed.date()!=requested.date():
            (out/'rejected-response.json').write_text(json.dumps({'requested':requested.isoformat(),'raw':payload},separators=(',',':')))
            raise ValueError(f'Historical validation failed: requested {requested.isoformat()}, returned {observed.isoformat()}, expiry {snap.get("exp")}, symbol {snap.get("s")}, strikes {len(data["strikes"])}')
        record={'requested_at':requested.isoformat(),'observed_at':observed.isoformat(),'expiry':expiry,'source_offset_seconds':(observed-requested).total_seconds(),'quality':'near_requested_time' if abs((observed-requested).total_seconds())<=60 else 'stale_or_out_of_window','raw':payload,'normalized':data}
        path.write_text(json.dumps(record,separators=(',',':')))
        records.append({'file':path.name,'requested_at':requested.isoformat(),'observed_at':observed.isoformat(),'strikes':len(data['strikes']),'source_offset_seconds':record['source_offset_seconds'],'quality':record['quality'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        if i%20==0 or i==360: print(f'{i+1}/361: {requested.strftime("%H:%M")} -> {observed.isoformat()}, {len(data["strikes"])} strikes',flush=True)
        if '--probe' in sys.argv: return
    manifest={'symbol':'NIFTY','date':'2026-10-29','timezone':'Asia/Kolkata','expiry':expiry,'start':'09:15','end':'15:15','interval_seconds':60,'count':len(records),'provider':'AOC v27','framework':'FNO-Analyzer AocClient.fetch_historical + parse_payload','records':records}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('COMPLETE',out,flush=True)
if __name__=='__main__': main()

