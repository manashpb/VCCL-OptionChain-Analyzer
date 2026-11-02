import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Aoc} from '../src/aoc.mjs';

test('AOC mirrors fail over on network/5xx errors and retain working server',async t=>{
 for(const failure of [new TypeError('network'),503]){
  const seen=[];const client=new Aoc('unused');
  t.mock.method(globalThis,'fetch',async url=>{seen.push(String(url));client.last=0;if(seen.length===1){if(failure instanceof Error)throw failure;return new Response('',{status:failure});}return new Response('{}');});
  await client.fetchServer('historical-data',{ticker:'NIFTY',timestamp:123},'synthetic');
  await client.fetchServer('live-data',{symbol:'NIFTY'},'synthetic');
  assert.equal(new URL(seen[0]).hostname,'v27.aoccalculator.in');
  assert.equal(new URL(seen[1]).hostname,'v27.niftychain.in');
  assert.equal(new URL(seen[2]).hostname,'v27.niftychain.in');
  assert.equal(new URL(seen[1]).searchParams.get('timestamp'),'123');
  t.mock.restoreAll();
 }
});

test('AOC does not bypass auth, missing resources, or rate limits',async t=>{
 for(const status of [401,403,404,429]){
  const client=new Aoc('unused');let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status});});
  assert.equal((await client.fetchServer('live-data',{},'synthetic')).status,status);
  assert.equal(calls,1);t.mock.restoreAll();
 }
});

test('AOC all-down attempts are bounded and recover after cooldown',async t=>{
 const client=new Aoc('unused');let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;client.last=0;throw Error('network');});
 await assert.rejects(client.fetchServer('live-data',{},'synthetic'),/could not be reached/);
 await assert.rejects(client.fetchServer('live-data',{},'synthetic'),/temporarily unavailable/);
 assert.equal(calls,2);
 client.failedServers.clear();t.mock.restoreAll();
 t.mock.method(globalThis,'fetch',async()=>new Response('{}'));
 assert.equal((await client.fetchServer('live-data',{},'synthetic')).status,200);
});
