import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,value,compareStrikes} from '../public/analytics.mjs';
const r=(values,quality='near_requested_time')=>({requested_at:String(values[0]),observed_at:'source',quality,strikes:values.slice(1).map(([sp,v])=>({sp,cVol:v,cOIC:v}))});
test('final top four fixed across history; denominator includes unselected strikes; legend descending',()=>{
 const rows=[r([0,[100,10],[200,5],[300,20],[400,4],[500,100]]),r([1,[100,100],[200,80],[300,60],[400,40],[500,1]])];
 const out=analyze(rows,'Vol','c');assert.deepEqual(out.series.map(s=>s.strike),[400,300,200,100]);assert.equal(out.leader,100);
 assert.equal(out.series.at(-1).points[0].pct,10);assert.equal(out.series.at(-1).points[1].pct,100);
 assert.deepEqual(out.markers,['1']);
 assert.equal(analyze(rows,'Vol','c',0).leader,500);
});
test('markers identify entries including ties, not every leading minute',()=>{
 const rows=[r([0,[100,10],[200,10]]),r([1,[100,12],[200,10]]),r([2,[100,9],[200,10]]),r([3,[100,15],[200,10]])];
 assert.deepEqual(analyze(rows,'Vol','c').markers,['0','3']);
});
test('negative change zero; absent, stale and zero denominator remain gaps',()=>{
 assert.equal(value({cOIC:-5},'cOIC'),0);assert.equal(value({},'cOIC'),null);
 const rows=[r([0,[100,-10],[200,20]]),r([1,[100,0],[200,0]]),r([2,[100,25],[200,30]],'stale_or_out_of_window'),r([3,[100,30],[200,20]])];
 const line=analyze(rows,'OIC','c').series.find(s=>s.strike===100);
 assert.deepEqual(line.points.map(p=>p.pct),[0,null,null,100]);
});

test('ATM grid uses reference spot; Cross OI uses next higher strike including outside displayed seven',()=>{
 const strikes=Array.from({length:11},(_,i)=>({sp:100+i*50,cOI:i*10,pOI:i*100,cOIC:-i,pOIC:i,cVol:i*20,pVol:i*30}));
 const records=[{requested_at:'a',observed_at:'a',quality:'near_requested_time',spot:249,strikes},{requested_at:'b',observed_at:'b',quality:'near_requested_time',spot:351,strikes}];
 const result=compareStrikes(records,'CrossOI');assert.equal(result.atm,350);assert.deepEqual(result.charts.map(c=>c.strike),[200,250,300,350,400,450,500]);
 assert.equal(result.charts[6].putStrike,550);assert.equal(result.charts[3].points[1].ce,50);assert.equal(result.charts[3].points[1].pe,600);
 assert.equal(compareStrikes(records,'OI',0).atm,250);
 assert.equal(compareStrikes(records,'OIC').charts[3].points[1].ce,0);
 assert.equal(compareStrikes([{...records[0],quality:'stale_or_out_of_window'}],'OI').atm,null);
});
