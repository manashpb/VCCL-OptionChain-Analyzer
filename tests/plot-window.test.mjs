import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plotWindow} from '../public/plot-window.mjs';
const start=Date.parse('2026-10-30T09:15:00+05:30');
const rows=Array.from({length:286},(_,i)=>({requested_at:new Date(start+i*60000).toISOString()}));
test('time windows end at the latest displayed snapshot and day includes all data',()=>{
 for(const minutes of [5,15,30,60])assert.deepEqual(plotWindow(rows,285,String(minutes)).range,[285-minutes,285]);
 assert.deepEqual(plotWindow(rows,285,'day').range,[0,285]);
 assert.deepEqual(plotWindow(rows,3,'60').range,[0,3]);
 assert.deepEqual(plotWindow(rows,120,'15').range,[105,120]);
});
test('window start uses timestamps, not row counts, and supports a single snapshot',()=>{
 const sparse=[rows[0],rows[10],rows[20]];
 assert.deepEqual(plotWindow(sparse,2,'15').range,[1,2]);
 assert.deepEqual(plotWindow([rows[0]],0,'5').range,[-0.5,0.5]);
 assert.equal(plotWindow(rows,285,'5').ticks.at(-1),285);
});
