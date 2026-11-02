import {dayAt,stamp,expiryDay} from './market.mjs';

export class LiveRecorder {
 constructor(store,provider,{random=Math.random,now=Date.now}={}){
  this.store=store;this.provider=provider;this.random=random;this.now=now;
  this.state={status:'starting',provider:'dhan',timestampKind:'snapshot-acquisition',error:null};
  this.nextAt=0;this.failures=0;this.running=false;this.stopped=false;this.authBlocked=false;
 }
 async tick(now=this.now()){
  if(this.running||this.authBlocked||now<this.nextAt)return;
  this.running=true;
  this.nextAt=now+60000+Math.floor(this.random()*10000);
  try{
   const day=dayAt(now),start=Date.parse(day+'T09:15:00+05:30'),end=Date.parse(day+'T15:30:00+05:30');
   const weekday=new Date(now+19800000).getUTCDay();
   this.state.day=day;
   if(weekday===0||weekday===6||now<start||now>end){this.state.status='outside-market-hours';return;}
   this.store.purge(day);
   const payload=await this.provider.live('NIFTY');
   const acquired=Date.parse(payload.refreshed_at),snapshot=payload.snapshot,strikes=payload.strikes;
   if(payload.source!=='dhan'||payload.timestamp_kind!=='snapshot-acquisition'||!Number.isFinite(acquired)||
      dayAt(acquired)!==day||Math.abs(acquired-now)>90000||acquired<start||acquired>end||
      snapshot?.s!=='NIFTY'||!expiryDay(snapshot.exp)||expiryDay(snapshot.exp)<day||!strikes?.length)
    throw Error('Dhan acquisition snapshot is invalid or stale');
   const minute=Math.floor(acquired/60000)*60000;
   const record={requested_at:stamp(minute),observed_at:stamp(acquired),quality:'near_requested_time',
    timestamp_kind:'snapshot-acquisition',spot:Number(snapshot.uv),normalized:{snapshot,strikes}};
   this.store.save(minute,snapshot.exp,record,'dhan-live','NIFTY');
   this.failures=0;this.state.status='recording';this.state.error=null;
   this.state.lastObserved=stamp(acquired);this.state.lastRequested=stamp(minute);
   this.state.saved=this.store.saved(day,'NIFTY').size;
  }catch(error){
   this.failures++;this.authBlocked=!!error.auth;
   this.state.status=this.authBlocked?'authentication-paused':'backing-off';
   this.state.error=error.auth?'Refresh Dhan through Token Sync, then restart the recorder':'Dhan unavailable; collection is backing off';
   this.nextAt=now+Math.max((error.retryAfter||0)*1000,Math.min(900000,60000*2**Math.min(this.failures,4)))+Math.floor(this.random()*10000);
  }finally{this.running=false;this.state.nextFetchAt=stamp(this.nextAt);}
 }
 start(){const loop=async()=>{if(this.stopped)return;await this.tick();if(!this.stopped&&!this.authBlocked)this.timer=setTimeout(loop,Math.max(1000,this.nextAt-this.now()));};loop();}
 stop(){this.stopped=true;clearTimeout(this.timer);}
}
