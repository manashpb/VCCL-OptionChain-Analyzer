export const metrics = [{id:'Vol',name:'Volume'},{id:'OI',name:'Open Interest'},{id:'OIC',name:'OI Change'}];
export function compareStrikes(records,metric,end=records.length-1){
  const rows=records.slice(0,end+1),ref=rows.at(-1);
  if(!ref||ref.quality!=='near_requested_time'||!Number.isFinite(ref.spot)||ref.spot<=0)return {atm:null,spot:null,charts:[]};
  const strikes=[...new Set(ref.strikes.map(r=>r.sp).filter(Number.isFinite))].sort((a,b)=>a-b);
  const atm=strikes.reduce((best,s)=>Math.abs(s-ref.spot)<Math.abs(best-ref.spot)?s:best,strikes[0]);
  const center=strikes.indexOf(atm),cross=metric==='CrossOI',field=cross?'OI':metric;
  const charts=Array.from({length:7},(_,i)=>{
    const offset=i-3,strike=strikes[center+offset]??null,putStrike=cross?(strikes[center+offset+1]??null):strike;
    return {offset,strike,putStrike,points:rows.map(r=>{
      const ce=r.strikes.find(s=>s.sp===strike),pe=r.strikes.find(s=>s.sp===putStrike),valid=r.quality==='near_requested_time';
      return {time:r.requested_at,observed:r.observed_at,ce:valid?value(ce,'c'+field):null,pe:valid?value(pe,'p'+field):null};
    })};
  });
  return {atm,spot:ref.spot,charts};
}
export function value(row, field) {
  const v=row?.[field];
  return typeof v==='number' && Number.isFinite(v) ? Math.max(0,v) : null;
}
export function analyze(records, metric, side, end=records.length-1) {
  const rows=records.slice(0,end+1), field=side+metric, latest=rows.at(-1);
  if(!latest) return {series:[],markers:[],leader:null};
  const ranked=latest.strikes.filter(r=>value(r,field)!==null).sort((a,b)=>value(b,field)-value(a,field)||a.sp-b.sp).slice(0,4);
  const leader=ranked[0]?.sp ?? null;
  const ranks=new Map(ranked.map((r,i)=>[r.sp,i]));
  const series=ranked.sort((a,b)=>b.sp-a.sp).map(r=>({strike:r.sp,rank:ranks.get(r.sp),latest:value(r,field),points:[]}));
  const markers=[]; let previouslyLeading=false;
  rows.forEach(record=>{
    const stale=record.quality!=='near_requested_time';
    const valid=record.strikes.map(r=>value(r,field)).filter(v=>v!==null);
    const max=valid.length?Math.max(...valid):0;
    const lookup=new Map(record.strikes.map(r=>[r.sp,r]));
    series.forEach(line=>{
      const raw=value(lookup.get(line.strike),field);
      line.points.push({time:record.requested_at,observed:record.observed_at,raw,pct:stale||raw===null||max<=0?null:100*raw/max});
    });
    const current=value(lookup.get(leader),field);
    const isLeading=!stale&&max>0&&current!==null&&Math.abs(current-max)<=Math.max(1e-8,max*1e-10);
    if(isLeading&&!previouslyLeading) markers.push(record.requested_at);
    previouslyLeading=isLeading;
  });
  return {series,markers,leader};
}
