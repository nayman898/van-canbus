// USB-powered, receive-only CAN data logger for classic ESP32-WROOM-32.
#include <Arduino.h>
#include <Preferences.h>
#include <SD.h>
#include <SPI.h>
#include <WebServer.h>
#include <WiFi.h>
#include <atomic>
#include <driver/twai.h>
#include <esp_system.h>
#include <esp_timer.h>
#include "logger_config.h"
#include "ignition_gate.h"
#include "logger_format.h"
#include "live_state.h"
#include "web_page.h"

QueueHandle_t records;
SemaphoreHandle_t sdLock;
SemaphoreHandle_t captureLock; // Only guards the recording flag and enqueue.
SemaphoreHandle_t liveLock;
LiveState<Config::LiveHistoryLength> live;
WebServer server(Config::WebPort);
Preferences preferences;
File activeFile;
String activePath;
String downloadPath;  // Pin a completed log against retention deletion.
uint32_t bootNumber;
unsigned segment = 0;
bool sdReady = false, canReady = false;
std::atomic<bool> recording{false}, storageFault{false}, readyForPowerOff{true};
std::atomic<uint32_t> received{0}, written{0}, queueDrops{0}, storageErrors{0};
std::atomic<uint32_t> driverMissed{0}, driverOverruns{0}, busErrors{0}, busState{0};
std::atomic<uint32_t> lastFrameMs{0}, freeMiB{0};
std::atomic<const char *> reason{"Starting"};
constexpr char CsvHeader[] = "timestamp_us,sequence,id,extended,rtr,dlc,data\n";

void setRecording(bool enabled) {
  xSemaphoreTake(captureLock, portMAX_DELAY);
  recording = enabled;
  xSemaphoreGive(captureLock);
}

// CAN reception never waits for SD or HTTP. Overflow is counted explicitly.
void receiveTask(void *) {
  uint32_t lastHealth = millis();
  for (;;) {
    if (millis() - lastHealth >= 1000) {
      lastHealth = millis();
      twai_status_info_t status;
      if (twai_get_status_info(&status) == ESP_OK) {
        driverMissed = status.rx_missed_count; driverOverruns = status.rx_overrun_count;
        busErrors = status.bus_error_count; busState = status.state;
        if (status.state == TWAI_STATE_BUS_OFF) twai_initiate_recovery();
        else if (status.state == TWAI_STATE_STOPPED) twai_start();
      }
    }
    twai_message_t message = {};
    if (twai_receive(&message, pdMS_TO_TICKS(100)) != ESP_OK) continue;
    CanRecord r = {};
    r.timestampUs = esp_timer_get_time();
    r.sequence = received.fetch_add(1) + 1;
    lastFrameMs = millis();
    r.id = message.identifier;
    r.extended = message.extd;
    r.rtr = message.rtr;
    r.dlc = message.data_length_code;
    if (r.dlc > 8) { queueDrops++; continue; }
    memcpy(r.data, message.data, r.dlc);
    xSemaphoreTake(liveLock, portMAX_DELAY);
    live.push(r);
    xSemaphoreGive(liveLock);
    xSemaphoreTake(captureLock, portMAX_DELAY);
    if (recording.load() && xQueueSend(records, &r, 0) != pdTRUE) queueDrops++;
    xSemaphoreGive(captureLock);
  }
}

// Call only with sdLock held. Keep old logs until reserve space is needed.
bool reclaimSpace() {
  uint64_t total = SD.totalBytes(), used = SD.usedBytes();
  if (total < Config::MinimumCardBytes || used > total) return false;
  for (unsigned attempt = 0; attempt < 32; ++attempt) {
    freeMiB = static_cast<uint32_t>((total - used) / (1024 * 1024));
    if (total - used >= Config::ReserveBytes) return true;
    File dir = SD.open("/logs");
    if (!dir) return false;
    String oldest;
    for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
      String name = f.name();
      if (!f.isDirectory() && validLogName(name.c_str())) {
        String path = "/logs/" + name;
        if (path != activePath && path != downloadPath && (oldest.isEmpty() || path < oldest)) oldest = path;
      }
      f.close();
    }
    dir.close();
    if (oldest.isEmpty() || !SD.remove(oldest)) return false;
    used = SD.usedBytes();
    if (used > total) return false;
  }
  return false;
}

bool openSegment() {
  if (segment >= 9999) return false;
  char path[40];
  snprintf(path, sizeof(path), "/logs/B%08lX-S%04u.csv",
      static_cast<unsigned long>(bootNumber), ++segment);
  // Never append to an earlier session if NVS was reset or a card moved.
  if (SD.exists(path)) return false;
  if (!reclaimSpace()) return false;
  activeFile = SD.open(path, FILE_WRITE);
  if (!activeFile) return false;
  activePath = path;
  if (activeFile.print(CsvHeader) != strlen(CsvHeader)) return false;
  activeFile.flush();
  return true;
}

void failStorage(const char *message) {
  setRecording(false);
  storageFault = true;
  reason = message;
  storageErrors++;
  if (activeFile) { activeFile.flush(); activeFile.close(); }
  activePath = "";
  // A fault is not a promise that the SD card has safely committed its writes.
  readyForPowerOff = false;
}

bool writeRecord(const CanRecord &r) {
  char line[112];
  const size_t n = formatRecord(line, sizeof(line), r);
  if (!n || !activeFile || activeFile.write(reinterpret_cast<uint8_t *>(line), n) != n) {
    failStorage("SD write failed; restart after checking card");
    return false;
  }
  written++;
  return true;
}

// sdLock held. Save counters at every safe stop; not a wall-clock timestamp.
void closeSession() {
  if (activeFile) { activeFile.flush(); activeFile.close(); }
  activePath = "";
  char path[40], text[400];
  snprintf(path, sizeof(path), "/logs/B%08lX-health.json", static_cast<unsigned long>(bootNumber));
  snprintf(text, sizeof(text),
      "{\"received\":%lu,\"written\":%lu,\"queue_drops\":%lu,\"driver_missed\":%lu,"
      "\"driver_overruns\":%lu,\"bus_errors\":%lu,\"storage_errors\":%lu}\n",
      (unsigned long)received.load(), (unsigned long)written.load(),
      (unsigned long)queueDrops.load(), (unsigned long)driverMissed.load(),
      (unsigned long)driverOverruns.load(), (unsigned long)busErrors.load(),
      (unsigned long)storageErrors.load());
  File health = SD.open(path, FILE_WRITE);
  if (!health || health.print(text) != strlen(text)) {
    if (health) health.close();
    failStorage("Could not save shutdown counters");
    return;
  }
  health.flush(); health.close();
  readyForPowerOff = true;
}

void storageTask(void *) {
  bool previousIgnition = false;
  IgnitionGate gate(Config::IgnitionDebounceMs);
  uint32_t lastFlush = millis(), lastSpace = millis();
  for (;;) {
    const uint32_t now = millis();
    const bool raw = !Config::UseIgnitionSense ||
        (digitalRead(Config::Ignition) == (Config::IgnitionActiveHigh ? HIGH : LOW));
    const bool enabled = gate.update(raw, digitalRead(Config::SafeStop) == LOW, now);
    const bool wanted = enabled && canReady && sdReady && !storageFault.load();
    xSemaphoreTake(sdLock, portMAX_DELAY);
    if (wanted && !recording.load()) {
      readyForPowerOff = false;
      if (openSegment()) { setRecording(true); reason = "Recording"; }
      else failStorage("Cannot open log or reclaim space; check card");
    } else if (!wanted && recording.load()) {
      // Serialize with the producer before draining; no timing assumption
      // about a receiver being preempted halfway through its enqueue.
      setRecording(false);
      CanRecord r;
      while (xQueueReceive(records, &r, 0) == pdTRUE && !storageFault.load()) writeRecord(r);
      if (!storageFault.load()) closeSession();
    }
    if (!recording.load() && !storageFault.load()) {
      reason = !canReady ? "CAN unavailable" : !Config::EnableSd ? "Live mode; SD recording off" :
          !sdReady ? "Live mode; no SD card" :
          gate.stopped() ? (Config::UseIgnitionSense ? "Safely stopped; cycle ignition to resume" :
              "Safely stopped; cycle USB power to resume") : "Ignition off";
    }
    // Bounded batches release the SD mutex regularly for web reads.
    CanRecord r;
    for (unsigned i = 0; i < 64 && recording.load() && xQueueReceive(records, &r, 0) == pdTRUE; ++i)
      if (!writeRecord(r)) break;
    if (recording.load() && now - lastFlush >= Config::FlushMs) {
      activeFile.flush(); lastFlush = now;
      if (activeFile.getWriteError()) failStorage("SD flush failed");
    }
    if (recording.load() && now - lastSpace >= 10000) {
      lastSpace = now;
      if (!reclaimSpace()) failStorage("SD reserve unavailable");
    }
    if (recording.load() && activeFile.size() >= Config::RotationBytes) {
      activeFile.flush(); activeFile.close(); activePath = "";
      if (!openSegment()) failStorage("SD rotation failed");
    }
    xSemaphoreGive(sdLock);
    digitalWrite(Config::StatusLed,
        storageFault.load() || !canReady || busState.load() != TWAI_STATE_RUNNING ? ((millis() / 250) % 2) :
            recording.load() || (received.load() && millis() - lastFrameMs.load() < 1500));
    if (previousIgnition != gate.ignitionOn()) {
      Serial.printf("Recording request %s\n", gate.ignitionOn() ? "on" : "off");
      previousIgnition = gate.ignitionOn();
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void sendStatus() {
  char json[768];
  const uint32_t last = lastFrameMs.load();
  snprintf(json, sizeof(json),
      "{\"recording\":%s,\"reason\":\"%s\",\"ready_for_power_off\":%s,"
      "\"received\":%lu,\"written\":%lu,\"queue_drops\":%lu,\"storage_errors\":%lu,"
      "\"driver_missed\":%lu,\"driver_overruns\":%lu,\"bus_errors\":%lu,\"bus_state\":%lu,"
      "\"free_mib\":%lu,\"last_frame_age_ms\":%lu,\"can_seen\":%s,\"uptime_ms\":%lu,"
      "\"sd_enabled\":%s,\"sd_ready\":%s,\"can_ready\":%s,\"storage_fault\":%s}",
      recording.load() ? "true" : "false", reason.load(), readyForPowerOff.load() ? "true" : "false",
      (unsigned long)received.load(), (unsigned long)written.load(), (unsigned long)queueDrops.load(),
      (unsigned long)storageErrors.load(), (unsigned long)driverMissed.load(),
      (unsigned long)driverOverruns.load(), (unsigned long)busErrors.load(),
      (unsigned long)busState.load(), (unsigned long)freeMiB.load(),
      (unsigned long)(last ? millis() - last : 0), received.load() ? "true" : "false",
      (unsigned long)millis(), Config::EnableSd ? "true" : "false", sdReady ? "true" : "false",
      canReady ? "true" : "false", storageFault.load() ? "true" : "false");
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void sendLive() {
  // Copy under a short lock; all formatting and HTTP happen after release.
  CanRecord frames[32];
  LiveCoolant coolant[2];
  LiveHeartbeat heartbeat;
  xSemaphoreTake(liveLock, portMAX_DELAY);
  const size_t n = live.copyRecent(frames, 32);
  coolant[0] = live.coolant[0]; coolant[1] = live.coolant[1];
  heartbeat = live.heartbeat;
  const size_t buffered = live.count();
  const uint32_t overwritten = live.overwritten;
  xSemaphoreGive(liveLock);
  const uint32_t now = millis();
  char text[768];
  String body; body.reserve(7000);
  snprintf(text, sizeof(text),
      "{\"boot\":%lu,\"uptime_ms\":%lu,\"received\":%lu,\"can_ready\":%s,\"bus_state\":%lu,"
      "\"can_seen\":%s,\"last_frame_age_ms\":%lu,\"recording\":%s,\"sd_enabled\":%s,"
      "\"sd_ready\":%s,\"storage_fault\":%s,\"reason\":\"%s\",\"ready_for_power_off\":%s,"
      "\"queue_drops\":%lu,\"driver_missed\":%lu,\"driver_overruns\":%lu,\"bus_errors\":%lu,"
      "\"storage_errors\":%lu,\"buffered\":%u,\"capacity\":%u,\"overwritten\":%lu,\"coolant\":[",
      (unsigned long)bootNumber, (unsigned long)now, (unsigned long)received.load(), canReady ? "true" : "false",
      (unsigned long)busState.load(), received.load() ? "true" : "false",
      (unsigned long)(now - lastFrameMs.load()), recording.load() ? "true" : "false",
      Config::EnableSd ? "true" : "false", sdReady ? "true" : "false", storageFault.load() ? "true" : "false",
      reason.load(), readyForPowerOff.load() ? "true" : "false", (unsigned long)queueDrops.load(),
      (unsigned long)driverMissed.load(), (unsigned long)driverOverruns.load(), (unsigned long)busErrors.load(),
      (unsigned long)storageErrors.load(), unsigned(buffered), Config::LiveHistoryLength, (unsigned long)overwritten);
  body += text;
  for (unsigned i = 0; i < 2; ++i) {
    const auto &c = coolant[i];
    snprintf(text, sizeof(text),
        "%s{\"seen\":%s,\"valid\":%s,\"status\":%u,\"adc\":%u,\"deci_c\":%d,\"age_ms\":%lu}",
        i ? "," : "", c.seen ? "true" : "false", c.valid ? "true" : "false",
        unsigned(c.status), unsigned(c.adc), int(c.deciC), (unsigned long)(now - c.updatedMs));
    body += text;
  }
  snprintf(text, sizeof(text),
      "],\"heartbeat\":{\"seen\":%s,\"valid\":%s,\"sequence\":%u,\"uptime_ms\":%lu,\"age_ms\":%lu},\"frames\":[",
      heartbeat.seen ? "true" : "false", heartbeat.valid ? "true" : "false", unsigned(heartbeat.sequence),
      (unsigned long)heartbeat.uptimeMs, (unsigned long)(now - heartbeat.updatedMs));
  body += text;
  for (size_t i = 0; i < n; ++i) {
    const auto &r = frames[i];
    char payload[17] = {};
    if (!r.rtr) for (unsigned j = 0; j < r.dlc; ++j) snprintf(payload + 2 * j, 3, "%02X", r.data[j]);
    snprintf(text, sizeof(text),
        "%s{\"sequence\":%lu,\"timestamp_us\":%llu,\"id\":%lu,\"extended\":%s,\"rtr\":%s,\"dlc\":%u,\"data\":\"%s\"}",
        i ? "," : "", (unsigned long)r.sequence, (unsigned long long)r.timestampUs, (unsigned long)r.id,
        r.extended ? "true" : "false", r.rtr ? "true" : "false", unsigned(r.dlc), payload);
    body += text;
  }
  body += "]}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", body);
}

void downloadRecent() {
  // Static storage keeps this 8 KiB snapshot off the small HTTP task stack.
  static CanRecord snapshot[Config::LiveHistoryLength];
  xSemaphoreTake(liveLock, portMAX_DELAY);
  const size_t n = live.copyRecent(snapshot, Config::LiveHistoryLength);
  xSemaphoreGive(liveLock);
  server.sendHeader("Content-Disposition", "attachment; filename=\"van-can-recent.csv\"");
  server.sendHeader("Cache-Control", "no-store");
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, "text/csv", "");
  server.sendContent(CsvHeader);
  char line[112];
  for (size_t i = 0; i < n && server.client().connected(); ++i) {
    if (formatRecord(line, sizeof(line), snapshot[i])) server.sendContent(line);
    delay(1);
  }
  server.sendContent("");
}

void listFiles() {
  if (!sdReady) { server.send(503, "text/plain", "SD unavailable"); return; }
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, "application/json", ""); server.sendContent("[");
  xSemaphoreTake(sdLock, portMAX_DELAY);
  File dir = SD.open("/logs");
  xSemaphoreGive(sdLock);
  bool first = true;
  for (;;) {
    xSemaphoreTake(sdLock, portMAX_DELAY);
    File f = dir ? dir.openNextFile() : File();
    if (!f) { if (dir) dir.close(); xSemaphoreGive(sdLock); break; }
    const String name = f.name();
    bool show = !f.isDirectory() && validLogName(name.c_str()) && "/logs/" + name != activePath;
    const size_t bytes = f.size();
    f.close(); xSemaphoreGive(sdLock);
    if (show) {
      char entry[100];
      snprintf(entry, sizeof(entry), "%s{\"name\":\"%s\",\"bytes\":%u}", first ? "" : ",", name.c_str(), unsigned(bytes));
      server.sendContent(entry); first = false;
    }
    if (!server.client().connected()) break;
    delay(1);
  }
  xSemaphoreTake(sdLock, portMAX_DELAY); if (dir) dir.close(); xSemaphoreGive(sdLock);
  server.sendContent("]"); server.sendContent("");
}

void downloadLog() {
  String name = server.arg("name");
  // Check String length as well: a URL-encoded NUL must not hide a suffix
  // from C-string validation or reach a response header.
  if (name.length() != 19 || !validLogName(name.c_str())) {
    server.send(400, "text/plain", "Invalid log name"); return;
  }
  if (!sdReady) { server.send(503, "text/plain", "SD unavailable"); return; }
  xSemaphoreTake(sdLock, portMAX_DELAY);
  const String path = "/logs/" + name;
  if (path == activePath) {
    xSemaphoreGive(sdLock); server.send(409, "text/plain", "File still recording"); return;
  }
  File file = SD.open(path, FILE_READ);
  const size_t size = file ? file.size() : 0;
  if (file) downloadPath = path;
  xSemaphoreGive(sdLock);
  if (!file) { server.send(404, "text/plain", "Log no longer available"); return; }
  server.sendHeader("Content-Disposition", "attachment; filename=\"" + name + "\"");
  server.setContentLength(size); server.send(200, "text/csv", "");
  auto client = server.client();
  uint8_t buffer[1024];
  size_t remaining = size;
  while (remaining && client.connected()) {
    xSemaphoreTake(sdLock, portMAX_DELAY);
    const int n = file.read(buffer, remaining < sizeof(buffer) ? remaining : sizeof(buffer));
    xSemaphoreGive(sdLock);
    if (n <= 0) break;
    size_t sent = 0;
    uint32_t progress = millis();
    while (sent < size_t(n) && client.connected() && millis() - progress < 2000) {
      const size_t count = client.write(buffer + sent, n - sent);
      if (count) { sent += count; progress = millis(); }
      delay(1);
    }
    if (sent != size_t(n)) break;
    remaining -= n;
    delay(1);
  }
  xSemaphoreTake(sdLock, portMAX_DELAY);
  file.close(); downloadPath = "";
  xSemaphoreGive(sdLock);
  if (remaining) client.stop();
}

void setup() {
  Serial.begin(115200);
  if (Config::UseIgnitionSense) pinMode(Config::Ignition, INPUT);
  pinMode(Config::SafeStop, INPUT_PULLUP);
  pinMode(Config::StatusLed, OUTPUT);
  if (Config::EnableSd) records = xQueueCreate(Config::QueueLength, sizeof(CanRecord));
  sdLock = xSemaphoreCreateMutex();
  captureLock = xSemaphoreCreateMutex();
  liveLock = xSemaphoreCreateMutex();
  if ((Config::EnableSd && !records) || !sdLock || !captureLock || !liveLock || !preferences.begin("vanlogger", false)) {
    Serial.println("Fatal: cannot allocate resources or open NVS");
    for (;;) delay(1000);
  }
  bootNumber = preferences.getUInt("boot", 0) + 1;
  if (!bootNumber || preferences.putUInt("boot", bootNumber) != sizeof(uint32_t)) {
    Serial.println("Fatal: cannot reserve unique boot number");
    for (;;) delay(1000);
  }
  String password = preferences.getString("wifi", "");
  WiFi.mode(WIFI_AP);
  if (password.length() != 16) {
    char generated[17]; snprintf(generated, sizeof(generated), "%08lX%08lX", (unsigned long)esp_random(), (unsigned long)esp_random());
    password = generated;
    if (preferences.putString("wifi", password) != password.length()) {
      Serial.println("Fatal: cannot save Wi-Fi password"); for (;;) delay(1000);
    }
  }
  preferences.end();
  char ssid[32]; snprintf(ssid, sizeof(ssid), "VanCAN-%06lX", (unsigned long)(ESP.getEfuseMac() & 0xFFFFFF));
  if (!WiFi.softAP(ssid, password.c_str(), 1, false, 2)) Serial.println("Wi-Fi AP failed; logging remains independent");
  Serial.printf("Wi-Fi: %s\nPassword: %s\nOpen http://192.168.4.1\n", ssid, password.c_str());
  if (Config::EnableSd) {
    SPI.begin(Config::SdSck, Config::SdMiso, Config::SdMosi, Config::SdCs);
    sdReady = SD.begin(Config::SdCs, SPI, 10000000) && SD.cardType() != CARD_NONE;
    if (sdReady) sdReady = SD.exists("/logs") || SD.mkdir("/logs");
  }

  twai_general_config_t general = TWAI_GENERAL_CONFIG_DEFAULT(
      static_cast<gpio_num_t>(Config::CanTx), static_cast<gpio_num_t>(Config::CanRx),
      Config::ListenOnly ? TWAI_MODE_LISTEN_ONLY : TWAI_MODE_NORMAL);
  general.rx_queue_len = 128; general.tx_queue_len = 0;
  twai_timing_config_t timing = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t filter = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  canReady = twai_driver_install(&general, &timing, &filter) == ESP_OK;
  if (canReady) canReady = twai_start() == ESP_OK;
  if (canReady) busState = TWAI_STATE_RUNNING;
  if (canReady && xTaskCreate(receiveTask, "can-rx", 4096, nullptr, 3, nullptr) != pdPASS) canReady = false;
  if (xTaskCreate(storageTask, "sd-writer", 6144, nullptr, 1, nullptr) != pdPASS) {
    reason = "Writer task allocation failed"; storageFault = true;
  }
  server.on("/", HTTP_GET, [] { server.send_P(200, "text/html", WebPage); });
  server.on("/api/status", HTTP_GET, sendStatus);
  server.on("/api/live", HTTP_GET, sendLive);
  server.on("/recent.csv", HTTP_GET, downloadRecent);
  server.on("/api/files", HTTP_GET, listFiles);
  server.on("/download", HTTP_GET, downloadLog);
  server.onNotFound([] { server.send(404, "text/plain", "Not found"); });
  server.begin();
}

void loop() {
  server.handleClient();
  delay(2);
}
