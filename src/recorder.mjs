import {dayAt,session,minutesDue,expiryDay,validate} from './market.mjs';
export class Recorder{
 constructor(store,aoc){this.store=store;this.aoc=aoc;this.state={status:'starting',error:null};this.attempts=new Map();this.activeDay=null;this.expiry=null;this.running=false;this.stopped=false;}
 async tick(now=Date.now()){
  if(this.running)return;this.running=true;
  try{
   const s=session(now);if(this.activeDay!==s.day){this.store.purge(s.day);this.activeDay=s.day;this.expiry=null;this.attempts.clear();}
   this.state.day=s.day;this.state.expected=minutesDue(now).length;
   if(!s.weekday||now<s.start){this.state.status='waiting';return;}
   if(!this.expiry){const response=await this.aoc.expiries();this.expiry=(Array.isArray(response)?response:response.data??[]).filter(e=>expiryDay(e)>=s.day).sort((a,b)=>expiryDay(a).localeCompare(expiryDay(b)))[0];if(!this.expiry)throw Error('No current NIFTY expiry available');}
   const saved=this.store.saved(s.day),due=minutesDue(now),liveMinute=Math.floor(now/60000)*60000;
   const eligible=minute=>saved.get(minute)!=='near_requested_time'&&now-(this.attempts.get(minute)??0)>=300000;
   let minute,source;
   if(now<=s.end+59000&&liveMinute>=s.start&&liveMinute<=s.end&&eligible(liveMinute)){minute=liveMinute;source='live';}
   else {minute=due.find(m=>m<liveMinute&&eligible(m));source='historical';}
   this.state.saved=[...saved.values()].filter(q=>q==='near_requested_time').length;this.state.expiry=this.expiry;
   if(minute===undefined){this.state.status=this.state.saved<due.length?'waiting-to-retry':now>s.end+59000?'complete':'recording';return;}
   this.attempts.set(minute,now);this.state.status=source==='live'?'recording':'backfilling';
   const payload=source==='live'?await this.aoc.live():await this.aoc.historical(this.expiry,minute);
   // A request crossing midnight cannot reinsert yesterday's data.
   if(dayAt()!==s.day)return;
   const record=validate(payload,minute,this.expiry);this.store.save(minute,this.expiry,record,source);
   this.state.error=record.quality==='near_requested_time'?null:'AOC returned a stale snapshot; retained as a visible gap and retried later';
   this.state.lastRequested=record.requested_at;this.state.lastObserved=record.observed_at;
   this.state.saved=[...this.store.saved().values()].filter(q=>q==='near_requested_time').length;
  }catch(e){this.state.status='retrying';this.state.error=/AOC|token|expiry|snapshot/.test(e.message)?e.message:'Provider temporarily unavailable';this.retryAt=Date.now()+60000;}
  finally{this.running=false;}
 }
 start(){const loop=async()=>{if(this.stopped)return;const day=dayAt();if(this.activeDay!==day||Date.now()>=(this.retryAt??0))await this.tick();if(!this.stopped)this.timer=setTimeout(loop,1000);};loop();}
 stop(){this.stopped=true;clearTimeout(this.timer);}
}
