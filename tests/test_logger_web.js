const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const header = fs.readFileSync(path.join(__dirname, '../esp32-logger/van_can_logger/web_page.h'), 'utf8');
const html = header.match(/R"HTML\(([\s\S]*)\)HTML";/)[1];
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length);
class Element {
  constructor(){ this.children=[]; this.listeners={}; this.attributes={}; this.textContent=''; this.hidden=false; this.value='all'; this.classList={toggle(){}}; }
  append(...items){ this.children.push(...items); }
  replaceChildren(...items){ this.children=[...items]; }
  setAttribute(name,value){ this.attributes[name]=value; }
  addEventListener(name,fn){ this.listeners[name]=fn; }
}
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const degrees=[new Element(),new Element()];
let now=1000;
const context=vm.createContext({
  document:{getElementById(id){assert.ok(elements[id],id);return elements[id];},createElement(){return new Element();},querySelectorAll(){return degrees;}},
  performance:{now:()=>now},localStorage:{getItem:()=>null,setItem(){}},
  fetch:()=>new Promise(()=>{}),AbortController,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
});
vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
const sample=()=>({seen:true,valid:true,status:0,adc:2098,deci_c:266,age_ms:0});
const state=()=>({boot:1,uptime_ms:1000,received:10,can_ready:true,bus_state:1,can_seen:true,last_frame_age_ms:0,
  recording:false,sd_enabled:false,sd_ready:false,storage_fault:false,reason:'Live mode; SD recording off',
  queue_drops:0,driver_missed:0,driver_overruns:0,bus_errors:0,storage_errors:0,buffered:10,capacity:256,overwritten:0,
  coolant:[sample(),{...sample(),deci_c:200}],heartbeat:{seen:true,valid:true,sequence:2,uptime_ms:3600000,age_ms:0},
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
console.log('ESP32 web checks passed: cardless operation, independent freshness, faults, units, disconnects and frozen frame view.');
