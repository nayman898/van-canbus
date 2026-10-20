#pragma once
static const char WebPage[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Van CAN · Live monitor</title>
<style>
:root{--bg:#101516;--panel:#181f20;--line:#303a3a;--text:#eef1e8;--muted:#9daaa6;--accent:#edc176;--green:#8ad5b3;--red:#ff9c8d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,sans-serif}
button,a,select{-webkit-tap-highlight-color:transparent}button,select,.button{font:inherit;color:var(--text);border:1px solid #47524e;background:#212a29;border-radius:8px;padding:10px 15px;cursor:pointer}
button:hover,.button:hover{border-color:var(--accent)}button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
a{color:var(--accent)}.button{text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}.primary{background:var(--accent);border-color:var(--accent);color:#20251f;font-weight:650}
header{border-bottom:1px solid var(--line)}.header-inner,main,footer{max-width:1120px;margin:auto;padding:24px 28px}.header-inner{display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand{font-size:15px;letter-spacing:.17em;font-weight:750}.brand span{color:var(--accent)}.connection{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px #edc17610}.connection.live{color:var(--green)}.live .dot{background:var(--green)}.connection.offline{color:var(--red)}.offline .dot{background:var(--red)}
main{padding-top:34px}.intro{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:.16em;font-weight:650;text-transform:uppercase}
h1{font-size:clamp(28px,5vw,38px);letter-spacing:-.045em;line-height:1.15;margin:7px 0 9px;font-weight:600}h2,h3,p{margin:0}h2{font-size:18px;font-weight:550}h3{font-size:15px;font-weight:500}.muted{color:var(--muted)}.small{font-size:12px}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}
.intro-actions{display:flex;gap:12px;align-items:center}.units{display:flex;padding:3px;background:#202827;border:1px solid var(--line);border-radius:9px}.units button{padding:7px 11px;border:0;background:none;color:var(--muted)}.units button[aria-pressed="true"]{background:#465049;color:var(--text)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:12px;margin-bottom:22px;overflow:hidden}.stat{padding:19px 23px;background:#151c1c}.stat+.stat{border-left:1px solid var(--line)}.stat .label{color:var(--muted);font-size:12px}.stat .value{font-size:23px;letter-spacing:-.03em;margin:5px 0 2px;font-weight:550}.stat .foot{font-size:11px;color:var(--muted)}
.fuel,.utility-card{grid-column:1/-1}.sensors>.stats,.sensors>.section{margin:0}.fuel-bar{height:10px;border-radius:6px;background:var(--line);overflow:hidden;margin:16px 0 22px}.fuel-bar-fill{height:100%;width:0;background:var(--accent)}
.sensors{display:grid;grid-template-columns:1fr 1fr;gap:20px}.sensor{border:1px solid var(--line);border-radius:12px;padding:23px;background:var(--panel);overflow:hidden}.card-heading{display:flex;align-items:start;justify-content:space-between;gap:14px}.tag{font:11px ui-monospace,monospace;color:var(--muted);border:1px solid #3b4743;border-radius:5px;padding:3px 6px;white-space:nowrap}.sensor .subtitle{font-size:12px;color:var(--muted);margin:3px 0 20px}
.reading{font-size:clamp(48px,8vw,68px);font-weight:450;letter-spacing:-.065em;line-height:1.15;font-variant-numeric:tabular-nums}.reading span{font-size:24px;color:var(--muted);letter-spacing:-.02em;margin-left:6px}.sensor-state{font-size:12px;color:var(--muted);margin:9px 0 16px;min-height:18px}.sensor-state.good{color:var(--green)}.sensor-state.fault{color:var(--red)}.chart{height:65px;width:100%;display:block;overflow:visible}.chart path{stroke:var(--green);stroke-width:2;fill:none;vector-effect:non-scaling-stroke}.sensor.post .chart path{stroke:#94c7dc}.chart.stale{opacity:.3}.chart-base{stroke:var(--line);stroke-width:1}.sensor-foot{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);margin-top:15px;padding-top:12px;font-size:11px;color:var(--muted)}
.section{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-top:22px;overflow:hidden}.section-header{padding:21px 23px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.section-header p{font-size:12px;color:var(--muted);margin-top:4px}.table-controls{display:flex;gap:8px}.table-controls button,.table-controls select{font-size:12px;padding:7px 10px}.table-wrap{overflow:auto;max-height:340px;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left;font-size:12px}th{position:sticky;top:0;z-index:1;color:var(--muted);font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;background:#151c1c}th,td{padding:11px 23px;border-bottom:1px solid #283231}tbody tr:last-child td{border:0}td:nth-child(2){color:var(--accent)}td:last-child{letter-spacing:.06em;color:#cdd7ce}.empty{padding:30px;text-align:center;color:var(--muted)}
.storage{padding:20px 23px;display:flex;justify-content:space-between;gap:20px;align-items:center}.storage p{font-size:12px;color:var(--muted);max-width:650px;margin-top:4px}.storage .button{font-size:12px;white-space:nowrap}#files{padding:0 23px 16px;list-style:none;margin:0}#files li{padding:8px 0;border-top:1px solid var(--line);font-size:12px}#file-note{padding:0 23px 18px}
details{margin-top:24px;color:var(--muted);font-size:12px}summary{cursor:pointer;padding:8px 0}#diagnostics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 20px;padding:14px 0;border-top:1px solid var(--line);margin-top:10px}#diagnostics strong{display:block;color:var(--text);font:15px ui-monospace,monospace;margin-top:4px}footer{padding-top:12px;padding-bottom:30px;display:flex;justify-content:space-between;gap:14px;font-size:11px;color:var(--muted)}[hidden]{display:none!important}.preview{padding:8px;background:#60451b;color:#fff;text-align:center;font-size:12px}
@media(max-width:640px){.header-inner,main,footer{padding-left:18px;padding-right:18px}.brand{font-size:12px}.connection{font-size:11px}.intro{align-items:start;flex-direction:column}.intro-actions{width:100%;justify-content:space-between}.stats{grid-template-columns:1fr 1fr}.stat{padding:14px}.stat:last-child{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}.stat .value{font-size:20px}.sensors{grid-template-columns:1fr}.sensor{padding:20px}.reading{font-size:62px}.section-header,.storage{padding:18px}.storage{align-items:start;flex-direction:column}.table-controls{width:100%}.table-controls select{flex:1}th,td{padding:10px 16px}#diagnostics{grid-template-columns:1fr 1fr}footer{flex-direction:column;gap:4px}}

.layout-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.layout-tools p{flex-basis:100%;font-size:12px;color:var(--muted)}
.card-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.card-controls button{min-width:48px;min-height:44px;padding:8px 12px;font-size:12px}.utility-card>.card-controls{padding:16px 20px 0;margin-bottom:0}.stats.utility-card{display:block}.capture-stats{display:grid;grid-template-columns:repeat(3,1fr)}
button:disabled{opacity:.35;cursor:default}.layout-empty{grid-column:1/-1;text-align:center;border:1px dashed var(--line);border-radius:12px;padding:30px}.layout-empty p{color:var(--muted);margin:8px 0 18px}
dialog{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:22px;max-width:min(420px,calc(100% - 30px));width:100%}dialog::backdrop{background:#0009}.picker-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.picker-list{display:grid;gap:10px}.picker-list button{text-align:left;min-height:48px}
@media(max-width:640px){.capture-stats{grid-template-columns:1fr 1fr}}
</style></head><body>
<div id="preview-banner" class="preview" hidden>Interface preview · simulated data</div>
<header><div class="header-inner"><div class="brand">VAN <span>/</span> CAN</div><div id="connection" class="connection" role="status"><span class="dot"></span><span id="connection-text">Connecting to gateway</span></div></div></header>
<main><div class="intro"><div><div class="eyebrow">Local telemetry / 500 kbit/s</div><h1>Live from the van.</h1><p class="muted small" id="last-update">Waiting for the first connection.</p></div>
<div class="intro-actions"><div class="units" role="group" aria-label="Temperature units"><button id="unit-f" aria-pressed="true">°F</button><button id="unit-c" aria-pressed="false">°C</button></div><a class="button primary" id="recent-download" href="/recent.csv">↓ Export recent CSV</a></div></div>
<div class="layout-tools"><button id="layout-edit" aria-expanded="false" aria-controls="dashboard-cards">Edit layout</button><button id="layout-add" hidden>Add card</button><button id="layout-reset" hidden>Reset layout</button><button id="layout-done" hidden>Done</button><p id="layout-note" role="status" hidden>Your layout is saved in this browser.</p></div>
<div class="sensors" id="dashboard-cards">
<div id="layout-empty" class="layout-empty" hidden><h2>Your dashboard is empty</h2><p>Add the sensors you want to monitor.</p><button id="layout-empty-add">Add card</button></div>
<article id="card-pre" class="sensor"><div id="controls-pre" class="card-controls" hidden></div><div class="card-heading"><h2>Engine outlet</h2><span class="tag">0x110</span></div><p class="subtitle">Coolant · before radiator</p><div class="reading"><b id="pre-value" style="font-weight:inherit">—</b><span class="degree">°F</span></div><p id="pre-state" class="sensor-state">Waiting for sensor</p><svg id="pre-chart" class="chart stale" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="Recent engine outlet temperature trend"><line class="chart-base" x1="0" y1="62" x2="300" y2="62"/><path id="pre-path"/></svg><div class="sensor-foot"><span>Recent sampled trend</span><span id="pre-adc" class="mono">ADC —</span></div></article>
<article id="card-post" class="sensor post"><div id="controls-post" class="card-controls" hidden></div><div class="card-heading"><h2>Radiator return</h2><span class="tag">0x111</span></div><p class="subtitle">Coolant · after radiator</p><div class="reading"><b id="post-value" style="font-weight:inherit">—</b><span class="degree">°F</span></div><p id="post-state" class="sensor-state">Waiting for sensor</p><svg id="post-chart" class="chart stale" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="Recent radiator return temperature trend"><line class="chart-base" x1="0" y1="62" x2="300" y2="62"/><path id="post-path"/></svg><div class="sensor-foot"><span>Recent sampled trend</span><span id="post-adc" class="mono">ADC —</span></div></article>
<article id="card-fuel" class="sensor fuel"><div id="controls-fuel" class="card-controls" hidden></div><div class="card-heading"><h2>Fuel level</h2><span class="tag">0x120</span></div><p class="subtitle">Uncalibrated · 10–75 Ω sender estimate</p><div class="reading"><b id="fuel-value" style="font-weight:inherit">—</b><span>% EST.</span></div><p id="fuel-state" class="sensor-state">Waiting for fuel sender</p><div id="fuel-bar" class="fuel-bar" role="progressbar" aria-label="Uncalibrated estimated fuel level" aria-valuemin="0" aria-valuemax="100" aria-valuetext="No valid fuel reading"><div id="fuel-bar-fill" class="fuel-bar-fill"></div></div><div class="sensor-foot"><span>Five-second level damping</span><span id="fuel-details" class="mono">Ω — · V — · ADC —</span></div></article>
<article id="card-engine" class="stats utility-card"><div id="controls-engine" class="card-controls" hidden></div><div class="capture-stats"><div class="stat"><div class="label">CAN frames received</div><div id="frame-count" class="value mono">—</div><div id="buffer-note" class="foot">Recent history held in memory</div></div>
<div class="stat"><div class="label">Engine uptime</div><div id="engine-uptime" class="value mono">—</div><div id="heartbeat-state" class="foot">Waiting for engine heartbeat</div></div>
<div class="stat"><div class="label">Recording</div><div id="storage-mode" class="value">Live only</div><div id="storage-summary" class="foot">An SD card is optional for live monitoring</div></div></div></article>
<section id="card-raw" class="section utility-card"><div id="controls-raw" class="card-controls" hidden></div><div class="section-header"><div><h2>On the wire</h2><p id="frames-caption">Latest CAN frames · reception continues while this view is frozen</p></div><div class="table-controls"><select id="frame-filter" aria-label="Filter CAN frames"><option value="all">All messages</option><option value="coolant">Coolant</option><option value="fuel">Fuel level</option><option value="heartbeat">Heartbeat</option></select><button id="freeze-frames" aria-pressed="false">Freeze view</button></div></div><div class="table-wrap"><table><thead><tr><th scope="col">Time since boot</th><th scope="col">CAN ID</th><th scope="col">Type / length</th><th scope="col">Payload</th></tr></thead><tbody id="frames-body"><tr><td colspan="4" class="empty">Frames will appear when the engine node connects.</td></tr></tbody></table></div></section>
</div>
<section class="section"><div class="storage"><div><h3 id="storage-title">Ready without an SD card.</h3><p id="storage-description">Use the live readings and export the latest 256 frames. This rolling history clears when the ESP32 loses power.</p></div><button id="refresh-files" hidden>Refresh SD logs</button></div><p id="file-note" class="small muted" hidden></p><ul id="files" hidden></ul></section>
<details><summary>Connection &amp; capture details</summary><div id="diagnostics"><div>Gateway uptime<strong id="gateway-uptime">—</strong></div><div>Capture drops<strong id="capture-drops">0</strong></div><div>CAN bus errors<strong id="bus-errors">0</strong></div><div>History replacements<strong id="history-overwritten">0</strong></div><div>SD write errors<strong id="sd-errors">0</strong></div><div>Heartbeat sequence<strong id="heartbeat-sequence">—</strong></div></div><p>History replacements are normal as the rolling buffer fills. RPM and pressure readings will appear after their engine-node messages are implemented.</p></details>
<dialog id="layout-picker" aria-labelledby="layout-picker-title"><div class="picker-heading"><h2 id="layout-picker-title">Add a card</h2><button id="layout-picker-close" aria-label="Close add card">Close</button></div><div id="layout-picker-list" class="picker-list"></div></dialog>
</main><footer><span>ESP32 gateway · local network · no internet required</span><span>Live monitoring works without storage.</span></footer>
<script>
const el=id=>document.getElementById(id);
const histories=[[],[]], sampleKeys=[null,null];
let model=null, lastSuccess=0, lastBoot=null, frozen=false, frozenRows=[], unit='F';
try{unit=localStorage.getItem('vancan-unit')==='C'?'C':'F';}catch(e){}

const cardCatalog=[{id:'pre',title:'Engine outlet coolant'},{id:'post',title:'Radiator return coolant'},
  {id:'fuel',title:'Fuel level'},{id:'engine',title:'Engine & capture status'},{id:'raw',title:'Raw CAN frames'}];
const layoutKey='vancan-layout-v1', cardNodes=new Map(cardCatalog.map(c=>[c.id,el('card-'+c.id)]));
let editingLayout=false, layoutSaved=true;
function decodeLayout(saved){
  const defaults=cardCatalog.map(c=>c.id);
  if(saved===null)return defaults;
  try{const parsed=JSON.parse(saved);if(!Array.isArray(parsed))return defaults;
    const ids=[...new Set(parsed.filter(id=>defaults.includes(id)))];
    return ids.length||parsed.length===0?ids:defaults;
  }catch(e){return defaults;}
}
let visibleCards;
try{visibleCards=decodeLayout(localStorage.getItem(layoutKey));}catch(e){visibleCards=decodeLayout(null);layoutSaved=false;}
function layoutButton(text,label,action){
  const button=document.createElement('button');button.type='button';button.textContent=text;
  button.setAttribute('aria-label',label);button.addEventListener('click',action);return button;
}
const cardControls=new Map();
for(const card of cardCatalog){
  const up=layoutButton('↑','Move '+card.title+' up',()=>moveCard(card.id,-1));
  const down=layoutButton('↓','Move '+card.title+' down',()=>moveCard(card.id,1));
  const remove=layoutButton('Remove','Remove '+card.title+' from dashboard',()=>removeCard(card.id));
  el('controls-'+card.id).append(up,down,remove);cardControls.set(card.id,{up,down});
}
function renderLayout(){
  const grid=el('dashboard-cards');
  for(const id of visibleCards)grid.append(cardNodes.get(id));
  for(const card of cardCatalog){
    const index=visibleCards.indexOf(card.id);cardNodes.get(card.id).hidden=index<0;
    el('controls-'+card.id).hidden=!editingLayout;
    const controls=cardControls.get(card.id);controls.up.disabled=index<=0;controls.down.disabled=index<0||index===visibleCards.length-1;
  }
  el('layout-empty').hidden=visibleCards.length!==0;
  el('layout-edit').hidden=editingLayout;el('layout-edit').setAttribute('aria-expanded',String(editingLayout));
  for(const id of ['layout-add','layout-reset','layout-done','layout-note'])el(id).hidden=!editingLayout;
  el('layout-add').disabled=visibleCards.length===cardCatalog.length;
  el('layout-note').textContent=layoutSaved?'Your layout is saved in this browser.':'Browser storage is unavailable. This layout lasts until you reload.';
}
function saveLayout(){
  try{localStorage.setItem(layoutKey,JSON.stringify(visibleCards));layoutSaved=true;}catch(e){layoutSaved=false;}
  renderLayout();
}
function moveCard(id,direction){
  if(direction!==-1&&direction!==1)return;
  const from=visibleCards.indexOf(id),to=from+direction;
  if(from<0||to<0||to>=visibleCards.length)return;
  [visibleCards[from],visibleCards[to]]=[visibleCards[to],visibleCards[from]];saveLayout();
  const controls=cardControls.get(id),preferred=controls[direction===-1?'up':'down'];
  (preferred.disabled?controls[direction===-1?'down':'up']:preferred).focus();
}
function removeCard(id){
  if(!visibleCards.includes(id))return;
  visibleCards=visibleCards.filter(card=>card!==id);saveLayout();
  el(visibleCards.length?'layout-add':'layout-empty-add').focus();
}
function addCard(id){
  if(!cardNodes.has(id)||visibleCards.includes(id))return;
  visibleCards.push(id);saveLayout();
}
function showCardPicker(){
  const list=el('layout-picker-list');list.replaceChildren();
  for(const card of cardCatalog.filter(c=>!visibleCards.includes(c.id))){
    list.append(layoutButton(card.title,'Add '+card.title,()=>{addCard(card.id);el('layout-picker').close();}));
  }
  if(list.children.length)el('layout-picker').showModal();
}
el('layout-edit').addEventListener('click',()=>{editingLayout=true;renderLayout();el('layout-done').focus();});
el('layout-done').addEventListener('click',()=>{editingLayout=false;renderLayout();el('layout-edit').focus();});
el('layout-reset').addEventListener('click',()=>{visibleCards=decodeLayout(null);saveLayout();});
for(const id of ['layout-add','layout-empty-add'])el(id).addEventListener('click',showCardPicker);
el('layout-picker-close').addEventListener('click',()=>el('layout-picker').close());
renderLayout();

function uptime(ms){const t=Math.floor(ms/1000);return `${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
function temperature(c){return unit==='F'?c*9/5+32:c;}
function connection(kind,text){el('connection').className='connection '+kind;el('connection-text').textContent=text;}
function sensorPresentation(c,extra,online){
  if(!online)return {value:'—',state:'Gateway unavailable',kind:'',fresh:false};
  if(!c||!c.seen)return {value:'—',state:'Waiting for sensor',kind:'',fresh:false};
  if(c.age_ms+extra>=1500)return {value:'—',state:'No recent sensor data',kind:'',fresh:false};
  if(!c.valid){const faults={1:'Open circuit',2:'Short circuit',4:'ADC error',8:'Calculation error'};
    return {value:'—',state:faults[c.status]||'Invalid sensor data',kind:'fault',fresh:true};}
  return {value:temperature(c.deci_c/10).toFixed(1),state:'Sensor online',kind:'good',fresh:true};
}
function fuelPresentation(f,extra,online){
  const invalid=(state,kind='',fresh=false)=>({value:'—',state,kind,fresh,percent:null});
  if(!online)return invalid('Gateway unavailable');
  if(!f||!f.seen)return invalid('Waiting for fuel sender');
  if(!Number.isFinite(f.age_ms)||f.age_ms+extra>=1500)return invalid('No recent fuel data');
  if(!f.valid){const faults={1:'Open circuit',2:'Short circuit',4:'ADC error',8:'Out of range'};
    return invalid(faults[f.status]||'Invalid fuel data','fault',true);}
  if(!Number.isFinite(f.estimated_percent)||f.estimated_percent<0||f.estimated_percent>100||
      !Number.isInteger(f.adc)||f.adc<=4||f.adc>=4050||
      !Number.isInteger(f.resistance_deci_ohms)||f.resistance_deci_ohms<50||f.resistance_deci_ohms>1000)
    return invalid('Invalid fuel data','fault',true);
  return {value:f.estimated_percent.toFixed(0),state:'Estimate only · tank calibration pending',kind:'',fresh:true,percent:f.estimated_percent};
}
function trendPath(points){
  const values=points.filter(v=>v!==null).map(temperature);if(values.length<2)return '';
  const low=Math.min(...values)-2, high=Math.max(...values)+2;let path='',move=true;
  points.forEach((v,i)=>{if(v===null){move=true;return;}const x=i/Math.max(1,points.length-1)*296+2,y=58-(temperature(v)-low)/(high-low)*52;
    path+=(move?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' ';move=false;});return path;
}
function render(online=true){
  if(!model){if(!online)connection('offline','Gateway unavailable');return;}
  const s=model, extra=Math.max(0,performance.now()-lastSuccess), available=online&&extra<2500;
  el('preview-banner').hidden=!s.preview;
  if(!available)connection('offline','Gateway unavailable');
  else if(!s.can_ready)connection('offline','CAN interface unavailable');
  else if(s.bus_state!==1)connection('offline',s.bus_state===2?'CAN bus off':s.bus_state===3?'CAN recovering':'CAN interface stopped');
  else if(!s.can_seen||s.last_frame_age_ms+extra>=1500)connection('','Waiting for CAN data');
  else connection('live','CAN live');
  el('last-update').textContent=!available?'Reconnect to the gateway Wi-Fi to resume live readings.':
    !s.can_seen?'Gateway connected. Waiting for the engine node.':`Last CAN frame ${((s.last_frame_age_ms+extra)/1000).toFixed(1)}s ago`;
  el('frame-count').textContent=Number(s.received).toLocaleString();
  el('buffer-note').textContent=`${s.buffered} / ${s.capacity} recent frames in memory`;
  const h=s.heartbeat, hbFresh=available&&s.can_ready&&s.bus_state===1&&h&&h.seen&&h.valid&&h.age_ms+extra<1500;
  el('engine-uptime').textContent=hbFresh?uptime(h.uptime_ms):'—';
  el('heartbeat-state').textContent=hbFresh?'Engine heartbeat online':!available?'Gateway unavailable':'Waiting for fresh heartbeat';
  el('heartbeat-sequence').textContent=hbFresh?h.sequence:'—';
  ['pre','post'].forEach((prefix,i)=>{
    const c=s.coolant[i],view=available&&(!s.can_ready||s.bus_state!==1)?
      {value:'—',state:'CAN interface unavailable',kind:'',fresh:false}:sensorPresentation(c,extra,available);
    el(prefix+'-value').textContent=view.value;el(prefix+'-state').textContent=view.state;
    el(prefix+'-state').className='sensor-state '+view.kind;
    el(prefix+'-adc').textContent=view.fresh&&c?'ADC '+c.adc:'ADC —';
    el(prefix+'-chart').classList.toggle('stale',!view.fresh||!c.valid);
    el(prefix+'-path').setAttribute('d',trendPath(histories[i]));
  });
  const f=s.fuel,fuelView=available&&(!s.can_ready||s.bus_state!==1)?
    {value:'—',state:'CAN interface unavailable',kind:'',fresh:false,percent:null}:fuelPresentation(f,extra,available);
  el('fuel-value').textContent=fuelView.value;el('fuel-state').textContent=fuelView.state;
  el('fuel-state').className='sensor-state '+fuelView.kind;
  const fuelAdcKnown=fuelView.fresh&&f&&Number.isInteger(f.adc)&&f.adc>=0&&f.adc<=4095;
  const fuelResistance=fuelView.percent!==null?(f.resistance_deci_ohms/10).toFixed(1):'—';
  el('fuel-details').textContent=fuelAdcKnown?
    `${fuelResistance} Ω · ${(f.adc*3.3/4095).toFixed(4)} V · ADC ${f.adc}`:'Ω — · V — · ADC —';
  el('fuel-bar-fill').style.width=(fuelView.percent===null?0:fuelView.percent)+'%';
  el('fuel-bar').setAttribute('aria-valuetext',fuelView.percent===null?'No valid fuel reading':fuelView.value+' percent, uncalibrated estimate');
  document.querySelectorAll('.degree').forEach(e=>e.textContent='°'+unit);
  el('unit-f').setAttribute('aria-pressed',String(unit==='F'));el('unit-c').setAttribute('aria-pressed',String(unit==='C'));
  const card=s.sd_enabled&&s.sd_ready;
  el('storage-mode').textContent=!available?'—':s.recording?'Recording to SD':s.storage_fault?'SD error':card?'SD stopped':'Live only';
  el('storage-summary').textContent=!available?'Storage status unavailable':s.recording?'Live monitoring stays available':card?s.reason:'No SD recording · live data available';
  el('storage-title').textContent=card?'SD recordings':s.storage_fault?'Storage needs attention':'Ready without an SD card.';
  el('storage-description').textContent=card?'Completed segments can be downloaded below. The physical stop button closes the active segment.':
    `Export the latest ${s.capacity} frames from memory. This rolling history clears when the ESP32 loses power.`;
  el('refresh-files').hidden=!card;el('files').hidden=!card;
  el('gateway-uptime').textContent=uptime(s.uptime_ms);
  el('capture-drops').textContent=(s.queue_drops+s.driver_missed+s.driver_overruns).toLocaleString();
  el('bus-errors').textContent=s.bus_errors;el('history-overwritten').textContent=s.overwritten;
  el('sd-errors').textContent=s.storage_errors;
}
function renderFrames(){
  const rows=frozen?frozenRows:(model?model.frames:[]), filter=el('frame-filter').value;
  const filtered=rows.filter(r=>filter==='all'||(!r.extended&&!r.rtr&&(filter==='heartbeat'?r.id===0x100:filter==='fuel'?r.id===0x120:r.id===0x110||r.id===0x111)));
  const body=el('frames-body');body.replaceChildren();
  if(!filtered.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.className='empty';cell.textContent='No matching frames yet.';row.append(cell);body.append(row);}
  for(const r of [...filtered].reverse()){
    const row=document.createElement('tr');
    const columns=[(r.timestamp_us/1000000).toFixed(3)+'s','0x'+r.id.toString(16).toUpperCase().padStart(r.extended?8:3,'0'),
      (r.extended?'EXT':'STD')+' · '+(r.rtr?'RTR · ':'')+r.dlc+' B',r.rtr?'Remote request':r.data.match(/.{1,2}/g)?.join(' ')||'—'];
    for(const text of columns){const cell=document.createElement('td');cell.className='mono';cell.textContent=text;row.append(cell);}body.append(row);
  }
  el('freeze-frames').textContent=frozen?'Resume view':'Freeze view';el('freeze-frames').setAttribute('aria-pressed',String(frozen));
  el('frames-caption').textContent=frozen?'Frame view frozen · reception and CSV export continue':'Latest 32 CAN frames · newest first';
}
function applyState(s){
  if(lastBoot!==s.boot){histories.forEach(h=>h.splice(0));sampleKeys.fill(null);frozen=false;frozenRows=[];lastBoot=s.boot;}
  s.coolant.forEach((c,i)=>{const key=(s.uptime_ms-c.age_ms)>>>0;
    if(c.seen&&key!==sampleKeys[i]){if(sampleKeys[i]!==null&&((key-sampleKeys[i])>>>0)>1500)histories[i].push(null);
      histories[i].push(c.valid?c.deci_c/10:null);while(histories[i].length>120)histories[i].shift();sampleKeys[i]=key;}});
  model=s;lastSuccess=performance.now();render();renderFrames();
}
async function poll(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2200);
  try{const response=await fetch('/api/live',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Unavailable');applyState(await response.json());}
  catch(e){lastSuccess=-10000;render(false);}
  finally{clearTimeout(timer);setTimeout(poll,500);}}
async function refreshFiles(){
  const list=el('files'),note=el('file-note');list.replaceChildren();note.hidden=false;note.textContent='Loading recordings…';
  try{const response=await fetch('/api/files',{cache:'no-store'});if(!response.ok)throw Error();const files=await response.json();
    for(const f of files){const li=document.createElement('li'),a=document.createElement('a');a.textContent=f.name+' · '+(f.bytes/1024).toFixed(1)+' KiB';a.href='/download?name='+encodeURIComponent(f.name);li.append(a);list.append(li);}
    note.textContent=files.length?'Completed files only; the active segment is still recording.':'No completed SD recordings yet.';
  }catch(e){note.textContent='SD files are unavailable. Live monitoring is independent of storage.';}}
for(const u of ['F','C'])el('unit-'+u.toLowerCase()).addEventListener('click',()=>{unit=u;try{localStorage.setItem('vancan-unit',u);}catch(e){}render();});
el('freeze-frames').addEventListener('click',()=>{if(!frozen)frozenRows=model?[...model.frames]:[];frozen=!frozen;renderFrames();});
el('frame-filter').addEventListener('change',renderFrames);el('refresh-files').addEventListener('click',refreshFiles);
setInterval(()=>render(),250);poll();
</script></body></html>)HTML";
