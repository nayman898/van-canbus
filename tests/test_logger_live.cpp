#include "../esp32-logger/van_can_logger/live_state.h"
#include <cassert>

int main() {
  LiveState<3> live;
  CanRecord out[3];
  assert(live.copyRecent(out, 3) == 0);
  CanRecord pre = {1000000, 1, 0x110, 8, false, false, {1, 1, 0, 7, 0x32, 8, 0x0A, 1}};
  live.push(pre);
  assert(live.coolant[0].valid && live.coolant[0].deciC == 266 && live.coolant[0].adc == 2098);
  assert(live.coolant[0].updatedMs == 1000 && !live.coolant[1].seen);
  CanRecord post = pre; post.id = 0x111; post.data[1] = 2; post.sequence = 2;
  post.data[6] = 0x9C; post.data[7] = 0xFF; // -10.0 C, independent signed sample.
  live.push(post);
  assert(live.coolant[1].valid && live.coolant[1].deciC == -100);
  pre.data[2] = 1; pre.sequence = 3; live.push(pre);
  assert(!live.coolant[0].valid && live.coolant[0].status == 1 && live.coolant[1].valid);
  assert(live.count() == 3 && live.overwritten == 0);
  pre.data[2] = 0; pre.data[0] = 2; pre.sequence = 4; live.push(pre);
  assert(!live.coolant[0].valid && live.overwritten == 1);
  assert(live.copyRecent(out, 3) == 3 && out[0].sequence == 2 && out[2].sequence == 4);
  assert(live.copyRecent(out, 1) == 1 && out[0].sequence == 4);
  pre.data[0] = 1; pre.data[1] = 2; live.push(pre);
  assert(!live.coolant[0].valid); // Mismatched ID/sensor identity.
  pre.data[1] = 1; pre.data[5] = 0x10; live.push(pre);
  assert(!live.coolant[0].valid); // ADC exceeds 12 bits.
  pre.data[5] = 8; pre.data[6] = 0; pre.data[7] = 0x80; live.push(pre);
  assert(!live.coolant[0].valid); // Invalid-temperature sentinel.
  pre.data[6] = 0x0A; pre.data[7] = 1; live.push(pre);
  assert(live.coolant[0].valid);
  pre.extended = true; pre.data[0] = 9; live.push(pre);
  assert(live.coolant[0].valid); // Extended identifiers are a separate namespace.
  pre.extended = false; pre.rtr = true; live.push(pre);
  assert(live.coolant[0].valid); // Remote requests carry no sensor reading.
  pre.rtr = false; pre.dlc = 7; live.push(pre);
  assert(live.coolant[0].seen && !live.coolant[0].valid);
  const auto count = live.overwritten; pre.dlc = 9; live.push(pre);
  assert(live.overwritten == count); // Reject impossible Classical CAN length.
  CanRecord heartbeat = {2000000, 20, 0x100, 8, false, false, {1, 1, 1, 42, 0x78, 0x56, 0x34, 0x12}};
  live.push(heartbeat);
  assert(live.heartbeat.valid && live.heartbeat.uptimeMs == 0x12345678 && live.heartbeat.sequence == 42);
  heartbeat.data[1] = 2; live.push(heartbeat); assert(!live.heartbeat.valid);
  heartbeat.data[1] = 1; heartbeat.dlc = 4; live.push(heartbeat); assert(!live.heartbeat.valid);
  assert(live.coolant[1].valid && live.coolant[1].updatedMs == 1000);

  LiveState<4> fuelLive;
  CanRecord fuel = {1000000, 1, 0x120, 8, false, false, {1, 1, 0, 7, 0x1e, 1, 0xef, 2}};
  fuelLive.push(fuel);
  assert(fuelLive.fuel.seen && fuelLive.fuel.valid && fuelLive.fuel.adc == 286);
  assert(fuelLive.fuel.resistanceDeciOhms == 751 && fuelLive.fuel.sequence == 7);
  assert(fuelLive.fuel.estimatedPercent == 0 && !fuelLive.coolant[0].seen);
  fuel.timestampUs = 1500000; fuel.data[4] = 41; fuel.data[5] = 0;
  fuel.data[6] = 101; fuel.data[7] = 0;
  fuelLive.push(fuel);
  assert(fuelLive.fuel.valid && fuelLive.fuel.resistanceDeciOhms == 101);
  assert(fuelLive.fuel.estimatedPercent > 9 && fuelLive.fuel.estimatedPercent < 10);
  // Duplicate polls/frames at the same timestamp cannot advance damping.
  const float previous = fuelLive.fuel.estimatedPercent;
  fuelLive.push(fuel); assert(fuelLive.fuel.estimatedPercent == previous);
  fuel.timestampUs = 3000000; fuelLive.push(fuel);
  assert(fuelLive.fuel.estimatedPercent > 99); // Stale gap resets smoothing.
  const CanRecord goodFuel = fuel;
  for (uint8_t status : {1, 2, 4, 8, 3, 16, 255}) {
    fuel = goodFuel; fuel.data[2] = status; fuelLive.push(fuel);
    assert(!fuelLive.fuel.valid);
    fuel = goodFuel; fuelLive.push(fuel);
    assert(fuelLive.fuel.valid && fuelLive.fuel.estimatedPercent > 99); // Fault recovery.
  }
  for (unsigned field : {0U, 1U}) {
    fuel = goodFuel; fuel.data[field] = 2; fuelLive.push(fuel);
    assert(!fuelLive.fuel.valid); // Unsupported version or sender identity.
  }
  for (uint16_t adc : {0, 4, 4050, 4095, 4096, 65535}) {
    fuel = goodFuel; fuel.data[4] = adc & 255; fuel.data[5] = adc >> 8;
    fuelLive.push(fuel); assert(!fuelLive.fuel.valid);
  }
  for (uint16_t resistance : {0, 49, 1001, 65535}) {
    fuel = goodFuel; fuel.data[6] = resistance & 255; fuel.data[7] = resistance >> 8;
    fuelLive.push(fuel); assert(!fuelLive.fuel.valid);
  }
  fuel = goodFuel; fuelLive.push(fuel);
  fuel.extended = true; fuel.data[0] = 9; fuelLive.push(fuel);
  assert(fuelLive.fuel.valid); // Extended namespace is ignored.
  fuel.extended = false; fuel.rtr = true; fuelLive.push(fuel);
  assert(fuelLive.fuel.valid); // RTR does not replace live data.
  fuel.rtr = false; fuel.dlc = 7; fuelLive.push(fuel);
  assert(fuelLive.fuel.seen && !fuelLive.fuel.valid);
  fuel = goodFuel;
  fuel.timestampUs = uint64_t(UINT32_MAX - 200U) * 1000U; fuelLive.push(fuel);
  fuel.timestampUs += 500000U; fuel.data[6] = 0xef; fuel.data[7] = 2;
  fuel.data[4] = 0x1e; fuel.data[5] = 1; fuelLive.push(fuel);
  assert(fuelLive.fuel.valid && fuelLive.fuel.estimatedPercent > 90); // millis rollover.
  const uint32_t fuelTime = fuelLive.fuel.updatedMs;
  fuelLive.push(post); fuelLive.push(heartbeat);
  assert(fuelLive.fuel.updatedMs == fuelTime && fuelLive.fuel.valid);
}
