const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const header = fs.readFileSync(path.join(__dirname, '../esp32-logger/van_can_logger/web_page.h'), 'utf8');
const html = header.match(/R"HTML\(([\s\S]*)\)HTML";/)[1];
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length);
class Element {
  constructor(){ this.children=[]; this.listeners={}; this.attributes={}; this.style={}; this.textContent=''; this.hidden=false; this.value='all'; this.classList={toggle(){}}; }
  append(...items){ for(const item of items){
    if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(child=>child!==item);
    this.children.push(item);item.parentNode=this;
  } }
  replaceChildren(...items){ for(const child of this.children)child.parentNode=null;this.children=[];this.append(...items); }
  focus(){ this.focused=true; }
  showModal(){ this.open=true; }
  close(){ this.open=false; }
  setAttribute(name,value){ this.attributes[name]=value; }
  addEventListener(name,fn){ this.listeners[name]=fn; }
}
let now=1000;
function makePage(saved={},readFails=false,writeFails=false){
  const elements=Object.fromEntries(ids.map(id=>{const node=new Element();node.id=id;return [id,node];}));
  const degrees=[new Element(),new Element()], storage=new Map(Object.entries(saved));
  elements['dashboard-cards'].append(elements['layout-empty'],...['pre','post','fuel','engine','raw'].map(id=>elements['card-'+id]));
  const context=vm.createContext({
    document:{getElementById(id){assert.ok(elements[id],id);return elements[id];},createElement(){return new Element();},querySelectorAll(){return degrees;}},
    performance:{now:()=>now},localStorage:{getItem(key){if(readFails)throw Error('Storage denied');return storage.get(key)??null;},setItem(key,value){if(writeFails)throw Error('Quota');storage.set(key,value);}},
    fetch:()=>new Promise(()=>{}),AbortController,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
  });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
  return {elements,context,storage};
}
const {elements,context}=makePage();
const sample=()=>({seen:true,valid:true,status:0,adc:2098,deci_c:266,age_ms:0});
const state=()=>({boot:1,uptime_ms:1000,received:10,can_ready:true,bus_state:1,can_seen:true,last_frame_age_ms:0,
  recording:false,sd_enabled:false,sd_ready:false,storage_fault:false,reason:'Live mode; SD recording off',
  queue_drops:0,driver_missed:0,driver_overruns:0,bus_errors:0,storage_errors:0,buffered:10,capacity:256,overwritten:0,
  coolant:[sample(),{...sample(),deci_c:200}],fuel:{seen:true,valid:true,status:0,adc:167,resistance_deci_ohms:425,estimated_percent:50,age_ms:0},heartbeat:{seen:true,valid:true,sequence:2,uptime_ms:3600000,age_ms:0},
  frames:[{sequence:1,timestamp_us:1000000,id:0x110,extended:false,rtr:false,dlc:8,data:'0101000732080A01'}]});
let s=state();context.applyState(s);
assert.equal(elements['pre-value'].textContent,'79.9');assert.equal(elements['post-value'].textContent,'68.0');
assert.equal(elements['storage-mode'].textContent,'Live only');assert.equal(elements['refresh-files'].hidden,true);
assert.equal(elements['connection-text'].textContent,'CAN live');assert.equal(elements['engine-uptime'].textContent,'1:00:00');
elements['unit-c'].listeners.click();assert.equal(elements['pre-value'].textContent,'26.6');
assert.equal(elements['unit-c'].attributes['aria-pressed'],'true');
s.coolant[0].age_ms=1490;context.applyState(s);now+=20;context.render();
assert.equal(elements['pre-value'].textContent,'—');assert.equal(elements['post-value'].textContent,'20.0');
s=state();s.coolant[1].valid=false;s.coolant[1].status=2;context.applyState(s);
assert.equal(elements['post-value'].textContent,'—');assert.equal(elements['post-state'].textContent,'Short circuit');
context.render(false);assert.equal(elements['pre-value'].textContent,'—');assert.equal(elements['engine-uptime'].textContent,'—');
s=state();context.applyState(s);now+=2600;context.render();
assert.equal(elements['pre-value'].textContent,'—');assert.equal(elements['connection-text'].textContent,'Gateway unavailable');
s=state();context.applyState(s);elements['freeze-frames'].listeners.click();
s=state();s.frames=[{...s.frames[0],id:0x100}];context.applyState(s);
assert.equal(elements['frames-body'].children[0].children[1].textContent,'0x110');
elements['freeze-frames'].listeners.click();assert.equal(elements['frames-body'].children[0].children[1].textContent,'0x100');
elements['frame-filter'].value='coolant';elements['frame-filter'].listeners.change();
assert.equal(elements['frames-body'].children[0].children[0].textContent,'No matching frames yet.');
s=state();s.bus_state=2;context.applyState(s);assert.equal(elements['pre-value'].textContent,'—');
assert.equal(elements['pre-state'].textContent,'CAN interface unavailable');
assert.equal(elements['engine-uptime'].textContent,'—');
s=state();s.bus_state=0;context.applyState(s);assert.equal(elements['connection-text'].textContent,'CAN interface stopped');
s=state();s.can_seen=false;s.coolant=[{seen:false},{seen:false}];s.heartbeat={seen:false};context.applyState(s);
assert.equal(elements['connection-text'].textContent,'Waiting for CAN data');assert.equal(elements['pre-state'].textContent,'Waiting for sensor');
assert.ok(!context.trendPath([20,21,null,22,23]).includes('NaN'));
assert.equal((context.trendPath([20,21,null,22,23]).match(/M/g)||[]).length,2);
s=state();context.applyState(s);
assert.equal(elements['fuel-value'].textContent,'50');assert.equal(elements['fuel-bar-fill'].style.width,'50%');
assert.ok(elements['fuel-details'].textContent.includes('42.5 Ω'));
assert.ok(elements['fuel-state'].textContent.includes('calibration pending'));
elements['unit-f'].listeners.click();assert.equal(elements['fuel-value'].textContent,'50');
s.fuel.age_ms=1490;context.applyState(s);now+=20;context.render();
assert.equal(elements['fuel-value'].textContent,'—');assert.notEqual(elements['pre-value'].textContent,'—');
assert.equal(elements['fuel-bar-fill'].style.width,'0%');
for(const [status,label] of [[1,'Open circuit'],[2,'Short circuit'],[4,'ADC error'],[8,'Out of range'],[16,'Invalid fuel data']]){
  s=state();s.fuel.valid=false;s.fuel.status=status;context.applyState(s);
  assert.equal(elements['fuel-state'].textContent,label);assert.equal(elements['fuel-value'].textContent,'—');
  assert.ok(elements['fuel-details'].textContent.startsWith('— Ω'));
  assert.ok(elements['fuel-details'].textContent.includes('ADC 167'));
}
for(const change of [{estimated_percent:null},{estimated_percent:NaN},{estimated_percent:101},{adc:4096},{adc:4},{resistance_deci_ohms:65535}]){
  s=state();Object.assign(s.fuel,change);context.applyState(s);assert.equal(elements['fuel-value'].textContent,'—');
}
s=state();context.applyState(s);context.render(false);assert.equal(elements['fuel-value'].textContent,'—');
s=state();context.applyState(s);now+=2600;context.render();assert.equal(elements['fuel-value'].textContent,'—');
s=state();s.bus_state=2;context.applyState(s);assert.equal(elements['fuel-state'].textContent,'CAN interface unavailable');
s=state();s.fuel={seen:false};context.applyState(s);assert.equal(elements['fuel-state'].textContent,'Waiting for fuel sender');
delete s.fuel;context.applyState(s);assert.equal(elements['fuel-state'].textContent,'Waiting for fuel sender');
s=state();s.frames.push({...s.frames[0],id:0x120});context.applyState(s);
elements['frame-filter'].value='fuel';elements['frame-filter'].listeners.change();
assert.equal(elements['frames-body'].children.length,1);assert.equal(elements['frames-body'].children[0].children[1].textContent,'0x120');
elements['freeze-frames'].listeners.click();s=state();s.frames=[];context.applyState(s);
assert.equal(elements['frames-body'].children[0].children[1].textContent,'0x120');
assert.equal(elements['fuel-value'].textContent,'50'); // Freeze affects raw frames only.
s.boot=2;s.fuel.estimated_percent=25;context.applyState(s);
assert.equal(elements['fuel-value'].textContent,'25');
assert.equal(elements['frames-body'].children[0].children[0].textContent,'No matching frames yet.');
console.log('ESP32 web checks passed: coolant/fuel freshness, faults, units, disconnects, raw filtering and freeze behavior.');

// Layout changes never remove live reading nodes or alter the capture model.
const layoutKey='vancan-layout-v1', defaults=['pre','post','fuel','engine','raw'];
const visible=page=>page.elements['dashboard-cards'].children.filter(node=>node.id.startsWith('card-')&&!node.hidden).map(node=>node.id.slice(5));
let page=makePage();
assert.deepEqual(visible(page),defaults);
assert.equal(page.elements['controls-pre'].hidden,true);
page.elements['layout-edit'].listeners.click();
assert.equal(page.elements['controls-pre'].hidden,false);
assert.equal(page.elements['controls-pre'].children[0].disabled,true);
assert.equal(page.elements['controls-raw'].children[1].disabled,true);
const fuelNode=page.elements['card-fuel'];
page.elements['controls-fuel'].children[0].listeners.click();
page.elements['controls-fuel'].children[0].listeners.click();
assert.deepEqual(visible(page),['fuel','pre','post','engine','raw']);
assert.strictEqual(page.elements['card-fuel'],fuelNode);
page.elements['controls-post'].children[2].listeners.click();
assert.equal(page.elements['card-post'].hidden,true);
assert.deepEqual(JSON.parse(page.storage.get(layoutKey)),['fuel','pre','engine','raw']);
let restarted=makePage(Object.fromEntries(page.storage));
assert.deepEqual(visible(restarted),['fuel','pre','engine','raw']);
assert.equal(restarted.elements['controls-fuel'].hidden,true); // Editing mode is never persisted.
restarted.context.applyState(state());
assert.equal(restarted.elements['post-value'].textContent,'68.0'); // Hidden card still updates.
restarted.elements['layout-edit'].listeners.click();
restarted.elements['layout-add'].listeners.click();
assert.equal(restarted.elements['layout-picker'].open,true);
assert.equal(restarted.elements['layout-picker-list'].children.length,1);
restarted.elements['layout-picker-list'].children[0].listeners.click();
assert.equal(restarted.elements['layout-picker'].open,false);
assert.deepEqual(visible(restarted),['fuel','pre','engine','raw','post']);
assert.equal(restarted.elements['layout-add'].disabled,true);
restarted.elements['layout-done'].listeners.click();
assert.equal(restarted.elements['controls-fuel'].hidden,true);
for(const id of defaults)restarted.context.removeCard(id);
assert.deepEqual(visible(restarted),[]);
assert.equal(restarted.elements['layout-empty'].hidden,false);
page=makePage(Object.fromEntries(restarted.storage));
assert.deepEqual(visible(page),[]);
page.elements['layout-empty-add'].listeners.click();
assert.equal(page.elements['layout-picker-list'].children.length,5);
page.elements['layout-picker-list'].children[2].listeners.click();
assert.deepEqual(visible(page),['fuel']);
page.context.addCard('fuel');page.context.addCard('unsupported');page.context.moveCard('fuel',1);page.context.moveCard('fuel',-1);page.context.moveCard('fuel',99);
assert.deepEqual(visible(page),['fuel']);
page.elements['layout-edit'].listeners.click();page.elements['layout-reset'].listeners.click();
assert.deepEqual(visible(page),defaults);
for(const saved of ['oops','null','{}','["obsolete"]'])assert.deepEqual(visible(makePage({[layoutKey]:saved})),defaults);
assert.deepEqual(visible(makePage({[layoutKey]:'["fuel","fuel","obsolete","pre"]'})),['fuel','pre']);
page=makePage({},true,true);page.elements['layout-edit'].listeners.click();page.context.removeCard('post');
assert.equal(page.elements['card-post'].hidden,true);
assert.ok(page.elements['layout-note'].textContent.includes('storage is unavailable'));
page.context.applyState(state());assert.equal(page.elements['pre-value'].textContent,'79.9');
console.log('ESP32 card layout checks passed: add/remove/reorder, reload, empty recovery, storage errors and continued hidden-card telemetry.');
