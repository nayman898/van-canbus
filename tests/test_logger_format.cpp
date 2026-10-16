#include "../esp32-logger/van_can_logger/logger_format.h"
#include "../esp32-logger/van_can_logger/ignition_gate.h"
#include <cassert>
#include <string>

int main() {
  char output[112];
  CanRecord record = {1234567890123ULL, 42, 0x110, 8, false, false,
                      {1, 1, 0, 7, 0x32, 8, 0x0A, 1}};
  assert(formatRecord(output, sizeof(output), record));
  assert(std::string(output) == "1234567890123,42,00000110,0,0,8,0101000732080A01\n");
  record.extended = true; record.id = 0x1FFFFFFF; record.dlc = 0;
  assert(formatRecord(output, sizeof(output), record));
  assert(std::string(output) == "1234567890123,42,1FFFFFFF,1,0,0,\n");
  record.rtr = true; record.dlc = 8;
  assert(formatRecord(output, sizeof(output), record));
  assert(std::string(output) == "1234567890123,42,1FFFFFFF,1,1,8,\n");
  record.dlc = 9;
  assert(!formatRecord(output, sizeof(output), record));
  record.dlc = 8; record.extended = false;
  assert(!formatRecord(output, sizeof(output), record));
  record.extended = true; record.id = 0x20000000;
  assert(!formatRecord(output, sizeof(output), record));
  record.id = 0x100;
  assert(!formatRecord(output, 5, record));
  assert(!formatRecord(nullptr, 0, record));
  assert(validLogName("B00000001-S0001.csv"));
  assert(validLogName("BFFFFFFFF-S9999.csv"));
  for (auto bad : {"", "../B00000001-S0001.csv", "/B00000001-S0001.csv",
                  "B00000001-S0001.csv/..", "B00000001-S0001.csv?", "B00000001-S00x1.csv",
                  "BG0000001-S0001.csv", "B00000001-S0001.json", "b00000001-S0001.csv"})
    assert(!validLogName(bad));
  assert(!validLogName(nullptr));

  IgnitionGate gate(250);
  assert(!gate.update(false, false, 0));
  assert(!gate.update(true, false, 10));
  assert(!gate.update(true, false, 259));
  assert(gate.update(true, false, 260));
  assert(!gate.update(true, true, 300));
  assert(!gate.update(true, false, 400)); // Release cannot undo the safe stop.
  assert(!gate.update(false, false, 500));
  assert(!gate.update(false, false, 750));
  assert(!gate.update(true, false, 800));
  assert(gate.update(true, false, 1050));
  assert(gate.update(false, false, 1100));
  assert(gate.update(true, false, 1200)); // Short ignition dip is ignored.
  assert(gate.update(true, false, 1500));
  assert(gate.update(false, false, 1600));
  assert(!gate.update(false, false, 1850));
  assert(!gate.ignitionOn());
  IgnitionGate wrapping(250);
  assert(!wrapping.update(true, false, UINT32_MAX - 100));
  assert(!wrapping.update(true, false, 100));
  assert(wrapping.update(true, false, 150));
}
