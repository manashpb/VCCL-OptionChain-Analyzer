import {plotWindow} from './plot-window.mjs';
import {analyze,metrics,compareStrikes} from './analytics.mjs';

const $=id=>document.getElementById(id);

const lineStyle=(rank,side)=>({color:rank===0?(side==='c'?'#dc2626':'#16a34a'):['','#eab308','#9333ea','#2563eb'][rank],width:rank<2?3.5:2,dash:['solid','dash','dash','dot'][rank]});

const clock=t=>new Date(t).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});

const source=t=>t?new Date(t).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'unavailable';

let sets=[], current, generation=0, activeTab="stability", selectedSymbol="NIFTY", refreshGeneration=0;

for(const [index,metric] of metrics.entries()){

  const section=document.createElement('section');section.className='figure';

  section.innerHTML=`<div class="figure-title"><span class="number">0${index+1}</span><h2>${metric.name} stability</h2><span>TOP 4 AT REFERENCE · RELATIVE TO EACH SNAPSHOT’S MAXIMUM</span></div><div class="pair">${['c','p'].map(side=>`<div class="panel"><div class="panel-head"><span>${side==='c'?'CE':'PE'} ${metric.name}</span><b class="${side==='c'?'ce':'pe'}">${side==='c'?'RESISTANCE':'SUPPORT'} <span id="leader-${metric.id}-${side}"></span></b></div><div class="chart" id="chart-${metric.id}-${side}"></div></div>`).join('')}</div>`;

  $('plots').append(section);

}

const timeWindows={stability:'day',comparison:'day'};
let userScrollRevision=0;
for(const type of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(type,()=>{userScrollRevision++;},{passive:true,capture:true});
const captureScroll=()=>({x:window.scrollX,y:window.scrollY,revision:userScrollRevision});
function restoreScroll(position){if(!position)return;requestAnimationFrame(()=>{if(position.revision===userScrollRevision)window.scrollTo({left:position.x,top:position.y,behavior:'instant'});});}
async function render(){const position=captureScroll();try{await renderPlots();}finally{restoreScroll(position);}}
async function renderPlots(){

  if(!current)return;const run=++generation,end=Number($('cutoff').value), rows=current.records.slice(0,end+1);

  const windowSpec=plotWindow(current.records,end,timeWindows[activeTab]);
  $('time').textContent=clock(rows.at(-1).requested_at)+' IST';

  const stale=rows.filter(r=>r.quality!=='near_requested_time').length;

  $('coverage').textContent=`${current.symbol} · ${rows.length} requested minutes · ${rows.length-stale} usable snapshots · 1 minute interval`;

  $('warning').textContent=stale?`${stale} stale or missing snapshot excluded from chart values. Source timestamps are preserved; missing values are not fabricated.`:'';

  if(activeTab==="comparison"){await renderComparison(end,run);return;}

  for(const metric of metrics)for(const side of ['c','p']){

    if(run!==generation)return;

    const result=analyze(current.records,metric.id,side,end), id=`chart-${metric.id}-${side}`;

    $(`leader-${metric.id}-${side}`).textContent=result.leader?.toLocaleString('en-IN')??'—';

    const traces=result.series.map(line=>({name:line.strike.toLocaleString('en-IN'),x:line.points.map(p=>clock(p.time)),y:line.points.map(p=>p.pct),customdata:line.points.map(p=>[p.raw,source(p.observed)]),mode:'lines',connectgaps:false,line:lineStyle(line.rank,side),hovertemplate:`${line.strike.toLocaleString('en-IN')} %{y:.2f}%<extra></extra>`}));

    const shapes=result.markers.map(t=>({type:'line',xref:'x',yref:'paper',x0:clock(t),x1:clock(t),y0:0,y1:1,line:{color:'#8898ac',width:1,dash:'dot'},layer:'below'}));

    shapes.push({type:'line',xref:'paper',yref:'y',x0:0,x1:1,y0:75,y1:75,line:{color:'#64748b',width:1.5,dash:'dot'},layer:'above'});
    await Plotly.react(id,traces,{margin:{l:52,r:20,t:15,b:67},paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'Segoe UI, Arial',size:11,color:'#687a90'},xaxis:{type:'category',categoryorder:'array',categoryarray:current.records.map(r=>clock(r.requested_at)),tickmode:'array',tickvals:windowSpec.ticks.map(i=>clock(current.records[i].requested_at)),unifiedhovertitle:{text:'%{x}'},title:{text:'Time · IST',font:{size:10}},gridcolor:'#f0f3f7',zeroline:false,range:windowSpec.range},yaxis:{title:{text:metric.name+' %',font:{size:11}},range:[50,100],fixedrange:true,ticksuffix:'%',dtick:25,gridcolor:'#e8edf4',zeroline:false},legend:{orientation:'h',y:-0.23,x:0,traceorder:'normal',font:{size:11}},hovermode:'x unified',hoverlabel:{bgcolor:'rgba(255,255,255,0)',bordercolor:'rgba(0,0,0,0)',font:{size:10,color:'#26384b'}},shapes,uirevision:`${current.symbol}-${current.date}-${current.expiry}-${timeWindows.stability}`,showlegend:true},{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['lasso2d','select2d'],toImageButtonOptions:{filename:`${current.symbol}-${metric.id}-${side}-${current.date}`,scale:2}});

  }

}

$('session').addEventListener('change',()=>{selectedSymbol=$('session').value;refreshData();});

let timer;$('cutoff').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,90);});

$('latest').onclick=()=>{$('cutoff').value=current.records.length-1;render();};

$('reset').onclick=()=>{if(!current)return;const range=plotWindow(current.records,Number($('cutoff').value),timeWindows[activeTab]).range;const charts=activeTab==='comparison'?document.querySelectorAll('#strike-grid .chart'):document.querySelectorAll('#plots .chart');for(const el of charts)if(el.classList.contains('js-plotly-plot'))Plotly.relayout(el,{'xaxis.range':range,...(activeTab==='stability'?{'yaxis.range':[50,100]}:{'yaxis.autorange':true})});};

async function refreshData(){
 const refresh=++refreshGeneration;let scrollPosition;
 try{
  const [res,statusRes]=await Promise.all([fetch('./api/data'),fetch('./api/status?symbol='+encodeURIComponent(selectedSymbol))]);
  if(!res.ok||!statusRes.ok)throw Error('Workspace session or data service unavailable');
  const status=await statusRes.json();if(refresh!==refreshGeneration)return;scrollPosition=captureScroll();const updated=t=>t?new Date(t).toLocaleString('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' IST':'Not available yet';$('data-freshness').textContent=status.mode==='replay'?'Local replay - saved archive':`Latest data snapshot: ${updated(status.latestSnapshotAt)} | Last successful save: ${updated(status.lastSavedAt)}`;document.querySelector('.tag').textContent=status.mode==='replay'?'LOCAL REPLAY':'CURRENT DAY';$('recorder-status').textContent=`${status.mode==='replay'?'Local replay':status.schedule+' | '+status.status+' | '+(status.saved??0)+' / '+(status.expected??0)+' snapshots'}${status.error?' | '+status.error:''}`;
  const next=await res.json();if(refresh!==refreshGeneration)return;const old=current,oldEnd=Number($('cutoff').value),follow=!old||oldEnd===old.records.length-1;
  sets=next;const chosen=sets.find(s=>s.symbol===selectedSymbol);$('session').replaceChildren(...['NIFTY','NIFTY-AI'].map(symbol=>new Option(symbol,symbol,false,symbol===selectedSymbol)));$('instrument-symbol').textContent=selectedSymbol;
  if(!chosen){current=null;$('coverage').textContent=`Waiting for ${selectedSymbol} current-day AOC snapshots`;$('expiry').textContent='No current-day snapshots';for(const el of document.querySelectorAll('.js-plotly-plot'))Plotly.purge(el);$('strike-grid').replaceChildren();$('atm-info').textContent='';return;}
  const changed=!old||JSON.stringify(old)!==JSON.stringify(chosen);current=chosen;
  $('cutoff').max=current.records.length-1;
  $('cutoff').value=follow||old?.date!==current.date||old?.symbol!==current.symbol?current.records.length-1:Math.min(oldEnd,current.records.length-1);$('expiry').textContent=`Expiry ${current.expiry}`;
  if(changed)await render();
 }catch(e){$('recorder-status').textContent=e.message;$('data-freshness').textContent='Unable to check data update time. Sign in again if your session expired.';}finally{restoreScroll(scrollPosition);}
}




async function renderComparison(end,run){

  const metric=$('quantity').value,result=compareStrikes(current.records,metric,end);

  $('atm-info').textContent=result.atm===null?'ATM unavailable at this reference snapshot':`Spot ${result.spot.toLocaleString('en-IN')}  /  ATM ${result.atm.toLocaleString('en-IN')}  /  ${clock(current.records[end].requested_at)} IST`;

  $('comparison-note').textContent=metric==='CrossOI'?'Cross OI: CE OI at each chart strike versus PE OI at the next higher available strike. Values use AOC source units.':'CE (red) versus PE (green) at the same strike. Values use AOC source units; negative OI change is zero.';

  const grid=$('strike-grid');const windowSpec=plotWindow(current.records,end,timeWindows.comparison);

  if(result.atm===null){for(const el of grid.querySelectorAll('.chart'))Plotly.purge(el);grid.replaceChildren();grid.textContent='Select a valid reference snapshot to calculate ATM.';return;}
  if(!grid.querySelector('.strike-card'))grid.replaceChildren();

  // Higher strikes above ATM, lower strikes below, ATM in the central cell.

  const order=[6,5,4,3,2,1,0];

  for(const i of order){

    if(run!==generation)return;

    const chart=result.charts[i];let card=$('strike-card-'+i);if(!card){card=document.createElement('article');card.id='strike-card-'+i;const title=document.createElement('h3'),canvas=document.createElement('div');canvas.className='chart';card.append(title,canvas);grid.append(card);}card.className='strike-card'+(chart.offset===0?' atm':'');

    if(chart.offset<0)card.style.gridRow='3';

    if(chart.offset===0)card.style.gridRow='2';

    const heading=card.querySelector('h3');heading.textContent=chart.strike?.toLocaleString('en-IN')??'Strike unavailable';

    const badge=document.createElement('span');badge.textContent=chart.offset===0?'ATM':`ATM ${chart.offset>0?'+':''}${chart.offset}`;heading.append(badge);

    const canvas=card.querySelector('.chart');

    const traces=['ce','pe'].map((side,index)=>({name:`${side.toUpperCase()} ${(index?chart.putStrike:chart.strike)?.toLocaleString('en-IN')??'unavailable'}`,x:chart.points.map(p=>clock(p.time)),y:chart.points.map(p=>p[side]),customdata:chart.points.map(p=>source(p.observed)),mode:'lines',connectgaps:false,line:{color:index?'#16a34a':'#dc2626',width:2.5},hovertemplate:'%{y:,.0f}<br>Requested %{x} IST<br>Source %{customdata} IST<extra>%{fullData.name}</extra>'}));

    await Plotly.react(canvas,traces,{margin:{l:65,r:15,t:12,b:65},font:{family:'Segoe UI, Arial',size:10,color:'#687a90'},xaxis:{type:'category',categoryorder:'array',categoryarray:current.records.map(r=>clock(r.requested_at)),range:windowSpec.range,tickmode:'array',tickvals:windowSpec.ticks.map(i=>clock(current.records[i].requested_at)),title:{text:'Time  /  IST'},gridcolor:'#f0f3f7'},yaxis:{rangemode:'tozero',title:{text:metric==='CrossOI'?'OI':metrics.find(m=>m.id===metric)?.name},gridcolor:'#e8edf4'},uirevision:`${current.symbol}-${current.date}-${chart.strike}-${metric}-${timeWindows.comparison}`,legend:{orientation:'h',y:-0.25},hovermode:'x unified',paper_bgcolor:'#fff',plot_bgcolor:'#fff'},{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['lasso2d','select2d']});

  }

}

for(const name of ['stability','comparison'])$('tab-'+name).onclick=()=>{activeTab=name;$('time-window').value=timeWindows.stability;$('comparison-time-window').value=timeWindows.comparison;$('time-window').parentElement.hidden=name!=='stability';applyPlotSize();$('reference-help').textContent=name==='stability'?'Top four strikes are selected at this time. Earlier snapshots use their own highest strike as 100%.':'ATM and the seven strikes are selected at this time, then held fixed across the plotted history.';document.querySelector('.status > span:last-child').hidden=name!=='stability';document.querySelector('.method').hidden=name!=='stability';$('plots').hidden=name!=='stability';$('comparison').hidden=name!=='comparison';for(const n of ['stability','comparison'])$('tab-'+n).setAttribute('aria-pressed',String(n===name));document.querySelector('h1').textContent=name==='stability'?'Strike stability':'ATM  /  CE vs PE';render();};

$('quantity').onchange=()=>render();
$('time-window').onchange=()=>{timeWindows.stability=$('time-window').value;render();};
$('comparison-time-window').onchange=()=>{timeWindows.comparison=$('comparison-time-window').value;render();};


const plotSizes={stability:{width:100,height:100},comparison:{width:100,height:100}};
try{const saved=JSON.parse(localStorage.getItem('optionchain-plot-sizes')||'{}');for(const tab of Object.keys(plotSizes))for(const dimension of ['width','height']){const v=saved[tab]?.[dimension];if(Number.isFinite(v))plotSizes[tab][dimension]=Math.max(dimension==='width'?40:25,Math.min(160,v));}}catch{}
let resizeFrame;
function applyPlotSize(){
  const size=plotSizes[activeTab],target=activeTab==='stability'?$('plots'):$('strike-grid');
  $('plot-width').value=size.width;$('plot-height').value=size.height;
  $('plot-width-value').textContent=size.width+'%';$('plot-height-value').textContent=size.height+'%';
  target.style.setProperty('--plot-width',size.width+'%');
  target.style.setProperty(activeTab==='stability'?'--stability-height':'--comparison-height',Math.max(110,(activeTab==='stability'?325:290)*size.height/100)+'px');
  cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{for(const chart of target.querySelectorAll('.js-plotly-plot'))Plotly.Plots.resize(chart);});
}
for(const dimension of ['width','height'])$('plot-'+dimension).oninput=()=>{plotSizes[activeTab][dimension]=Number($('plot-'+dimension).value);applyPlotSize();try{localStorage.setItem('optionchain-plot-sizes',JSON.stringify(plotSizes));}catch{}};
$('size-reset').onclick=()=>{plotSizes[activeTab]={width:100,height:100};applyPlotSize();try{localStorage.setItem('optionchain-plot-sizes',JSON.stringify(plotSizes));}catch{}};
applyPlotSize();

await refreshData();setInterval(refreshData,15000);
