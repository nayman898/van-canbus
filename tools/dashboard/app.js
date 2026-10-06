const byId = (id) => document.getElementById(id);

function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function setConnection(kind, text) {
  const element = byId("connection");
  element.className = `status status-${kind}`;
  byId("connection-text").textContent = text;
}

function updateDashboard(state) {
  const stale = state.last_frame_age_ms === null || state.last_frame_age_ms > 1500;
  if (!state.connected) {
    setConnection("fault", "U2C disconnected");
  } else if (stale) {
    setConnection("waiting", "Waiting for CAN data");
  } else {
    setConnection("live", "CAN live");
  }

  byId("bitrate").textContent = Math.round(state.bitrate / 1000);
  byId("frame-count").textContent = state.frames_received.toLocaleString();
  byId("last-update").textContent = state.last_frame_age_ms === null
    ? "No frames received"
    : `Last frame ${state.last_frame_age_ms} ms ago`;

  if (state.heartbeat) {
    byId("node-uptime").textContent = formatUptime(state.heartbeat.uptime_ms);
    byId("heartbeat-sequence").textContent = state.heartbeat.sequence;
  }

  updateCoolant("", state.coolant, state.connected);
  updateCoolant("post-", state.coolant_post, state.connected);
}

function updateCoolant(prefix, coolant, connected) {
  const element = (id) => byId(prefix + id);
  const fresh = connected && coolant && coolant.age_ms < 1500;
  const valid = fresh && coolant.valid;
  element("voltage").textContent = fresh ? coolant.voltage.toFixed(3) : "--.---";
  element("adc").textContent = fresh ? coolant.adc_raw : "----";
  element("temp-f").textContent = valid ? coolant.temperature_f.toFixed(1) : "--.-";
  element("temp-c").textContent = valid ? coolant.temperature_c.toFixed(1) : "--.-";
  element("sensor-state").textContent = !fresh ? "Stale / no data" : valid ? "Sensor online"
    : `FAULT · ${coolant.status ? coolant.status_text.toUpperCase() : "INVALID READING"}`;
  element("sensor-state").className = valid ? "sensor-state" : "sensor-state sensor-fault";
  const percentage = valid ? Math.max(0, Math.min(100, (coolant.temperature_f - 32) / 218 * 100)) : 0;
  element("temperature-fill").style.width = `${percentage}%`;
}

async function poll() {
  try {
    const response = await fetch("/api/state", {cache: "no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    updateDashboard(await response.json());
  } catch (error) {
    setConnection("fault", "Dashboard backend unavailable");
    updateCoolant("", null, false);
    updateCoolant("post-", null, false);
  }
}

poll();
setInterval(poll, 250);
