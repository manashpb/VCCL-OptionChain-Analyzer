export function plotWindow(records,end,selection='day'){
 const last=Math.max(0,Math.min(end,records.length-1));
 const minutes=selection==='day'?Infinity:Number(selection);
 const cutoff=Date.parse(records[last]?.requested_at)-minutes*60000;
 let first=0;
 if(Number.isFinite(minutes)){
  first=records.findIndex((r,i)=>i<=last&&Date.parse(r.requested_at)>=cutoff);
  if(first<0)first=last;
 }
 const span=last-first,stride=span<=10?1:span<=30?5:span<=60?10:60;
 const ticks=[];for(let i=first;i<=last;i+=stride)ticks.push(i);
 if(ticks.at(-1)!==last)ticks.push(last);
 return {range:first===last?[first-0.5,last+0.5]:[first,last],ticks};
}
