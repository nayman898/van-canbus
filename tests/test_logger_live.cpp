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
}
