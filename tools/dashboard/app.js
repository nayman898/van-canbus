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

  if (!state.coolant) return;
  const coolant = state.coolant;
  byId("voltage").textContent = coolant.voltage.toFixed(3);
  byId("adc").textContent = coolant.adc_raw;

  if (coolant.status !== 0) {
    byId("temp-f").textContent = "---";
    byId("temp-c").textContent = "---";
    byId("sensor-state").textContent = `FAULT · ${coolant.status_text.toUpperCase()}`;
    byId("sensor-state").className = "sensor-state sensor-fault";
    byId("temperature-fill").style.width = "0";
    return;
  }

  byId("temp-f").textContent = coolant.temperature_f.toFixed(1);
  byId("temp-c").textContent = coolant.temperature_c.toFixed(1);
  byId("sensor-state").textContent = "Sensor online";
  byId("sensor-state").className = "sensor-state";
  const percentage = Math.max(0, Math.min(100, (coolant.temperature_f - 32) / (250 - 32) * 100));
  byId("temperature-fill").style.width = `${percentage}%`;
}

async function poll() {
  try {
    const response = await fetch("/api/state", {cache: "no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    updateDashboard(await response.json());
  } catch (error) {
    setConnection("fault", "Dashboard backend unavailable");
  }
}

poll();
setInterval(poll, 250);
