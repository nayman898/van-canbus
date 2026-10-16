#pragma once

// Classic ESP32-WROOM-32 development board; not ESP32-C3/S3 pin assignments.
namespace Config {
// Live monitoring works immediately, without an SD breakout or card.
// Enable later, with the SPI wiring and a formatted card installed.
constexpr bool EnableSd = false;
constexpr unsigned LiveHistoryLength = 256;
constexpr int CanTx = 26;
constexpr int CanRx = 27;
constexpr int SdSck = 18;
constexpr int SdMiso = 19;
constexpr int SdMosi = 23;
constexpr int SdCs = 13;
// Default: record whenever the owner's switched USB supply powers the board.
// Enable only when adding a separate ignition input and delayed-off supply.
constexpr bool UseIgnitionSense = false;
// Optional input: protected 0/3.3V only, with an external 10k pull-down.
constexpr int Ignition = 34;
constexpr int SafeStop = 32;  // Normally open button to GND; hold until stopped.
constexpr int StatusLed = 25; // Optional LED through 1k to GND.
constexpr bool IgnitionActiveHigh = true;
constexpr unsigned QueueLength = 1024;
constexpr unsigned FlushMs = 1000;
constexpr unsigned IgnitionDebounceMs = 250;
constexpr unsigned RotationBytes = 16 * 1024 * 1024;
constexpr unsigned ReserveBytes = 64 * 1024 * 1024;
constexpr unsigned MinimumCardBytes = 256 * 1024 * 1024;
constexpr unsigned WebPort = 80;
// false: ACK valid frames, never transmit data; works with the STM32 alone.
// true: strictly passive, requires another CAN node to provide ACKs.
constexpr bool ListenOnly = false;
}
