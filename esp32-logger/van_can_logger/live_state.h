#pragma once
#include "logger_format.h"
#include <algorithm>
#include <cmath>

struct LiveCoolant {
  bool seen = false, valid = false;
  uint8_t status = 0;
  uint16_t adc = 0;
  int16_t deciC = 0;
  uint32_t updatedMs = 0;
};

struct LiveHeartbeat {
  bool seen = false, valid = false;
  uint8_t sequence = 0;
  uint32_t uptimeMs = 0, updatedMs = 0;
};

struct LiveFuel {
  bool seen = false, valid = false;
  uint8_t status = 0, sequence = 0;
  uint16_t adc = 0, resistanceDeciOhms = UINT16_MAX;
  float estimatedPercent = 0;
  uint32_t updatedMs = 0;
};

// Caller provides synchronization. This object allocates no heap memory.
template <size_t Capacity> class LiveState {
  static_assert(Capacity > 0, "History must contain at least one record");
 public:
  LiveCoolant coolant[2];
  LiveHeartbeat heartbeat;
  LiveFuel fuel;
  uint32_t overwritten = 0;

  void push(const CanRecord &r) {
    if (r.dlc > 8) return;
    history_[next_] = r;
    next_ = (next_ + 1) % Capacity;
    if (count_ < Capacity) ++count_; else ++overwritten;
    if (r.extended || r.rtr) return;
    const uint32_t at = static_cast<uint32_t>(r.timestampUs / 1000);
    if (r.id == 0x110 || r.id == 0x111) {
      const unsigned channel = r.id - 0x110;
      LiveCoolant &c = coolant[channel];
      c = LiveCoolant{};
      c.seen = true; c.updatedMs = at;
      if (r.dlc != 8) return;
      c.status = r.data[2];
      c.adc = uint16_t(r.data[4]) | (uint16_t(r.data[5]) << 8);
      const uint16_t raw = uint16_t(r.data[6]) | (uint16_t(r.data[7]) << 8);
      c.deciC = static_cast<int16_t>(raw <= 32767 ? int32_t(raw) : int32_t(raw) - 65536);
      c.valid = r.data[0] == 1 && r.data[1] == channel + 1 &&
          c.status == 0 && c.adc <= 4095 && c.deciC != -32768;
    } else if (r.id == 0x120) {
      const LiveFuel previous = fuel;
      fuel = LiveFuel{};
      fuel.seen = true; fuel.updatedMs = at;
      if (r.dlc != 8) return;
      fuel.status = r.data[2]; fuel.sequence = r.data[3];
      fuel.adc = uint16_t(r.data[4]) | (uint16_t(r.data[5]) << 8);
      fuel.resistanceDeciOhms = uint16_t(r.data[6]) | (uint16_t(r.data[7]) << 8);
      fuel.valid = r.data[0] == 1 && r.data[1] == 1 && fuel.status == 0 &&
          fuel.adc > 4 && fuel.adc < 4050 &&
          fuel.resistanceDeciOhms >= 50 && fuel.resistanceDeciOhms <= 1000;
      if (!fuel.valid) return;
      // Electrical endpoint estimate only; custom tank calibration is pending.
      const float target = std::max(0.0f, std::min(100.0f,
          (750.0f - fuel.resistanceDeciOhms) / 6.5f));
      const uint32_t elapsed = at - previous.updatedMs;
      if (!previous.valid || elapsed >= 1500) fuel.estimatedPercent = target;
      else fuel.estimatedPercent = previous.estimatedPercent +
          (1.0f - std::exp(-float(elapsed) / 5000.0f)) * (target - previous.estimatedPercent);
    } else if (r.id == 0x100) {
      heartbeat = LiveHeartbeat{};
      heartbeat.seen = true; heartbeat.updatedMs = at;
      heartbeat.valid = r.dlc == 8 && r.data[0] == 1 && r.data[1] == 1;
      if (!heartbeat.valid) return;
      heartbeat.sequence = r.data[3];
      heartbeat.uptimeMs = uint32_t(r.data[4]) | (uint32_t(r.data[5]) << 8) |
          (uint32_t(r.data[6]) << 16) | (uint32_t(r.data[7]) << 24);
    }
  }

  size_t count() const { return count_; }
  // Copy the most recent N records, oldest first, without exposing ring storage.
  size_t copyRecent(CanRecord *destination, size_t limit) const {
    const size_t n = std::min(count_, limit);
    const size_t start = (next_ + Capacity - n) % Capacity;
    for (size_t i = 0; i < n; ++i) destination[i] = history_[(start + i) % Capacity];
    return n;
  }
 private:
  CanRecord history_[Capacity] = {};
  size_t next_ = 0, count_ = 0;
};
