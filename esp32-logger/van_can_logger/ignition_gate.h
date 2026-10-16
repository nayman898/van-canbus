#pragma once
#include <cstdint>

class IgnitionGate {
 public:
  explicit IgnitionGate(uint32_t debounceMs) : debounceMs_(debounceMs) {}
  bool update(bool rawOn, bool stopPressed, uint32_t now) {
    if (rawOn != candidate_) { candidate_ = rawOn; changedAt_ = now; }
    // Unsigned subtraction also handles the millisecond counter wrapping.
    if (uint32_t(now - changedAt_) >= debounceMs_) on_ = candidate_;
    if (!on_) stopped_ = false;
    if (stopPressed) stopped_ = true;
    return on_ && !stopped_;
  }
  bool ignitionOn() const { return on_; }
  bool stopped() const { return stopped_; }
 private:
  uint32_t debounceMs_, changedAt_ = 0;
  bool candidate_ = false, on_ = false, stopped_ = false;
};
