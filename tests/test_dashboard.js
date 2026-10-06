// No browser/dependencies needed: exercise the actual UI update functions.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..", "tools", "dashboard");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "unique HTML IDs");
const elements = Object.fromEntries(ids.map((id) => [id, {style: {}}]));
const context = vm.createContext({
  document: {getElementById: (id) => {
    assert.ok(elements[id], `missing HTML element ${id}`);
    return elements[id];
  }},
  fetch: () => new Promise(() => {}),
  setInterval: () => {},
});
vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
const pre = {age_ms: 0, valid: true, status: 0, temperature_f: 180,
  temperature_c: 82.2, voltage: 1, adc_raw: 1241};
const post = {...pre, temperature_f: 150, temperature_c: 65.6};
const state = {connected: true, last_frame_age_ms: 0, bitrate: 500000,
  frames_received: 10, coolant: pre, coolant_post: post};
context.updateDashboard(state);
assert.equal(elements["temp-f"].textContent, "180.0");
assert.equal(elements["post-temp-f"].textContent, "150.0");
pre.age_ms = 1500;
context.updateDashboard(state);
assert.equal(elements["temp-f"].textContent, "--.-");
assert.equal(elements["post-temp-f"].textContent, "150.0");
pre.age_ms = 0;
post.valid = false;
post.status = 1;
post.status_text = "open circuit";
context.updateDashboard(state);
assert.equal(elements["temp-f"].textContent, "180.0");
assert.equal(elements["post-temp-f"].textContent, "--.-");
assert.match(elements["post-sensor-state"].textContent, /OPEN CIRCUIT/);
state.coolant_post = null;
context.updateDashboard(state);
assert.match(elements["post-sensor-state"].textContent, /no data/);
state.connected = false;
context.updateDashboard(state);
assert.equal(elements["temp-f"].textContent, "--.-");
assert.equal(elements["temperature-fill"].style.width, "0%");
console.log("Browser dashboard dual-temperature checks passed");
