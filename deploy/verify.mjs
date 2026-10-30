// Run on VCCL with the workspace's private environment loaded; never prints credentials/cookies.
import assert from 'node:assert/strict';
const origin=process.env.PORTAL_ORIGIN,user=process.env.JOURNAL_USER,password=process.env.JOURNAL_PASSWORD;
assert.ok(origin&&user&&password,'Load workspace environment');
const get=(route,cookie)=>fetch(origin+route,{redirect:'manual',headers:cookie?{Cookie:cookie}:{}});
assert.equal((await get('/optionchain/')).status,303);
assert.equal((await get('/optionchain/api/data')).status,401);
assert.equal((await get('/verify')).status,404);
const page=await get('/login'),guest=page.headers.get('set-cookie').split(';')[0];
const csrf=/name="csrf" value="([^"]+)"/.exec(await page.text())[1];
const login=await fetch(origin+'/login',{method:'POST',redirect:'manual',headers:{Cookie:guest,Origin:origin},body:new URLSearchParams({username:user,password,csrf})});
assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
try{
 const home=await(await get('/',cookie)).text();assert.ok(home.includes('href="/optionchain/"'));
 for(const route of ['/optionchain/','/optionchain/app.mjs','/optionchain/plotly.min.js'])assert.equal((await get(route,cookie)).status,200);
 const status=await(await get('/optionchain/api/status',cookie)).json();
 const sets=await(await get('/optionchain/api/data',cookie)).json();
 console.log(JSON.stringify({status,sessions:sets.map(s=>({date:s.date,expiry:s.expiry,slots:s.records.length,valid:s.records.filter(r=>r.quality==='near_requested_time').length,live:s.records.filter(r=>r.source==='live').length,historical:s.records.filter(r=>r.source==='historical').length}))},null,2));
 assert.equal((await fetch('http://127.0.0.1:5005/optionchain/api/data')).status,401);
 const logoutCsrf=/name="csrf" value="([^"]+)"/.exec(home)[1];
 await fetch(origin+'/logout',{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:origin},body:new URLSearchParams({csrf:logoutCsrf})});
 assert.equal((await get('/optionchain/api/data',cookie)).status,401);
 console.log('Public routing, shared login, protected assets/API, independent backend verification and logout passed.');
}catch(e){throw Error('Deployment verification failed: '+e.message);}
