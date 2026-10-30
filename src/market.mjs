export const IST_OFFSET=19800000;
export const dayAt=(ms=Date.now())=>new Date(ms+IST_OFFSET).toISOString().slice(0,10);
export const stamp=ms=>new Date(ms+IST_OFFSET).toISOString().replace('Z','+05:30');
export function session(ms=Date.now()){
 const day=dayAt(ms),start=Date.parse(day+'T09:15:00+05:30'),end=Date.parse(day+'T14:00:00+05:30');
 const weekday=new Date(ms+IST_OFFSET).getUTCDay();
 return {day,start,end,weekday:weekday!==0&&weekday!==6};
}
export function minutesDue(ms){const s=session(ms);if(!s.weekday||ms<s.start)return [];return Array.from({length:Math.floor((Math.min(ms,s.end)-s.start)/60000)+1},(_,i)=>s.start+i*60000);}
export function expiryDay(v){
 const m=/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(v);
 if(!m)return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase())+1;
 return month?`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;
}
export function normalize(payload){
 const data=payload.data??payload,decode=obj=>Object.fromEntries((obj?.k??[]).map((k,i)=>[k,obj.v?.[i]??null]));
  if(Array.isArray(data.strikes)&&data.snapshot&&typeof data.snapshot==='object')return {snapshot:data.snapshot,strikes:data.strikes};
 return {snapshot:decode(data.snapshot),strikes:(data.strikes?.v??[]).map(v=>decode({k:data.strikes.k,v} ))};
}
export function validate(payload,minute,expiry,symbol='NIFTY'){
 const data=normalize(payload),s=data.snapshot;
 const ts=Number(s.ts),observed=ts>1e11?ts:ts*1000;
 if(!(symbol==='NIFTY-AI'?['NIFTY','NIFTY-AI']:[symbol]).includes(String(s.s).toUpperCase())||expiryDay(s.exp)!==expiryDay(expiry)||!data.strikes.length||!Number.isFinite(observed)||dayAt(observed)!==dayAt(minute)||expiryDay(s.dt)!==dayAt(minute))throw Error('AOC snapshot symbol, expiry or date mismatch');
 const offset=(observed-minute)/1000;
 return {requested_at:stamp(minute),observed_at:stamp(observed),quality:Math.abs(offset)<=60?'near_requested_time':'stale_or_out_of_window',spot:Number(s.uv),normalized:data};
}
