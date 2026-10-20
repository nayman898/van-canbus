# ESP32 CAN logger and local Wi-Fi gateway

[Project home](../README.md) · [CAN protocol](can-protocol.md) ·
[Firmware sketch](../esp32-logger/van_can_logger/van_can_logger.ino) ·
[Parts list](../hardware/esp32-logger/bom.csv) ·
[Connections](../hardware/esp32-logger/connections.csv)

Use one existing **classic ESP32-WROOM-32 development board** as a permanent
cabin logger. The owner selected **ignition-on recording only**, using an existing
**regulated 5V USB-C converter on an ignition-switched feed**. The default build
is a live web monitor and works **without any SD breakout or card**. An external
SPI microSD breakout can add continuous recording later.
Firmware compilation, decoder/UI tests and simulated desktop/mobile browser
checks pass; the first board is flashed and boots normally. The October 16
photo shows the ESP32 and CAN Pal on the proto board, and the owner confirmed
the case's bottom offsets fit. Wired-CAN, device-browser, optional SD and
vehicle-power acceptance tests still need recording. Start with the cardless
steps below; this is not yet a validated permanent vehicle installation.

### First board flashed — October 15, 2026

The connected board on Windows **COM8** was identified as an ESP32-D0WD-V3
revision 3.1 with 4 MB flash. The live-only build (`EnableSd = false`) was
flashed with esptool 5.1.0; all four programmed regions passed write verification.
Startup serial output confirmed hotspot **VanCAN-1F8A3C**, normal application
boot and no repeated resets during the console observation. The generated
password is kept in the local ignored console capture, not in this guide.
Open **http://192.168.4.1** after joining the hotspot. Actual phone-browser and
wired-CAN operation on the device still need confirmation; simulated browser
checks do not replace those hardware tests. COM numbering may change.

## What it does

- Receives Classical CAN at 500 kbit/s. The web page shows both coolant channels,
  independent freshness/fault states, engine heartbeat/uptime, sampled temperature
  trends, °F/°C controls, and a filterable/freezable raw-frame view.
- Decodes fuel level `0x120` from the updated Nucleo firmware. Shows voltage,
  resistance/count and a five-second-damped **uncalibrated** 10–75-ohm level
  estimate. Fuel stale/fault status is independent of the coolant channels;
  fuel frames are included in RAM CSV and optional SD recording.
- Offers **Edit layout** with add/remove cards, move up/down, reset and automatic
  browser-local layout saving. Hidden cards keep receiving data and CSV logging
  continues. Engine/capture status and raw frames can also be hidden or reordered.
- Keeps the latest **256 frames in RAM** independently of SD recording. Export
  them using **Export recent CSV**. This is a rolling snapshot, not an entire-trip
  recording; history disappears when power is removed. The table shows the newest
  32 frames; freezing it does not pause reception or CSV capture.
- Uses normal CAN mode to acknowledge the STM32 even when the U2C is absent.
  No application CAN transmit function, Wi-Fi-to-CAN command route or OTA endpoint exists.
  Set `ListenOnly` in the configuration only if another node supplies ACKs.
- With SD enabled, starts a new CSV segment automatically on power-up, with no ignition-sense
  wiring required. A physical stop button closes the file and latches recording
  off until power cycles. Key-off removes power; automatic clean closure is not
  provided by the selected USB supply.
- Separates live capture from HTTP and optional SD recording. SD mode adds a 1024-record queue.
  This provides buffering, not a guarantee of lossless full-bus-rate capture.
- With SD enabled, flushes about once a second and rotates at 16 MiB. At low space it **deletes
  oldest CSV logs** to maintain a 64 MiB reserve. Active/downloaded logs are protected.
  Back up trips that must be retained. Shutdown health JSON files are retained.
- Creates a local password-protected Wi-Fi hotspot serving the dashboard and exports.
  The page needs no internet or external scripts/fonts. A phone/browser is needed
  to view it, while capture continues independently of the browser connection.

## Use it now without a card

1. Wire the ESP32 and CAN Pal below; power the ESP32 through USB. The SD pins
   can remain disconnected. `EnableSd = false` is the shipped configuration.
2. Flash the firmware and read the hotspot name/password from the serial console
   at 115200 baud. Join `VanCAN-xxxxxx` on the phone/head unit and open
   **http://192.168.4.1**. Stay connected when warned that the hotspot has no internet.
3. The page shows **Live only**, with no SD error or requirement to install a card.
   Coolant and fuel readings clear independently after 1.5 seconds without updates;
   a lost gateway connection clears live values rather than leaving frozen readings.
4. Download a RAM snapshot with **Export recent CSV**. Save it before switching
   USB power off. Missing samples overwritten in the rolling history are counted
   separately from actual driver/queue drops.

The fuel card requires the updated engine-node firmware and the
[isolated FG72A circuit](fuel-level.md), with the original gauge disconnected.
It does not require any sender wires connected to the ESP32: only the existing
CAN Pal connection. No fuel frames means **Waiting for fuel sender**, rather
than a guessed level. Percentage is provisional until custom tank calibration.

RPM and pressure are not decoded yet because their STM32 messages are not
implemented. Unknown IDs still appear in the raw view and recent CSV.

To preview the interface on the PC without hardware, run:

```sh
python tools/preview_esp32_logger.py
```

Open `http://127.0.0.1:8766`. The amber preview banner explicitly identifies
simulated data. `--scenario stale`, `--scenario fault` and `--scenario no-can`
exercise other states. This preview never connects to or transmits on CAN.

## Additional hardware

### Printed cabin enclosure

The owner confirmed an approximately **81 × 51 mm Adafruit proto board**,
**13 mm from PCB top to the CAN terminals**, and **all cables leaving one side**.
This corrects the earlier 19 mm estimate; the owner confirmed the bottom
offsets fit. The prototype uses the half-size Perma-Proto 1609 outline. **Compact V3**
uses the owner's October 16 assembly photo (`PXL_20261016_124356420.jpg`) to
reduce side/end space and accommodate the ESP32 covering the front PCB hole.

- [Print and assembly instructions](../hardware/protective-plates/esp32-case/PRINT-ME.txt)
- [Exploded preview](../hardware/protective-plates/esp32-case/preview.png)
- [Board fit test](../hardware/protective-plates/esp32-case/board_fit_test.stl)
  and [screw fit test](../hardware/protective-plates/esp32-case/screw_fit_test.stl)
- [Base](../hardware/protective-plates/esp32-case/base.stl),
  [lid](../hardware/protective-plates/esp32-case/lid.stl), and
  [removable cable panel](../hardware/protective-plates/esp32-case/cable_panel.stl)
- [Editable dimensions](../hardware/protective-plates/esp32_case.json) and
  [generator](../hardware/protective-plates/esp32_case.py)

Body size is **60.8 × 100.28 × 28.4 mm**, or **76.8 mm wide** including mounting
ears. Body footprint is **26.8% smaller** than V1. The PCB has 5 mm side margins,
10 mm at the cable end and 9 mm at the rear. Height allows 6 mm below the PCB
and provides the measured **13 mm above the PCB plus 3 mm headroom**. V3 is
**6 mm lower than V2**; all bottom offsets and retainers are unchanged.
The panel has a centred **18 × 16 mm USB** notch and a **6 × 16 mm CAN wire**
notch to its right, captured by the lid. Check the actual USB plug and wire
bundle fit these openings. Print the V3 base and panel; an existing **V2 lid
can be reused**. V2's panel is too tall and V1 parts do not fit this footprint.

The covered front mounting hole is unused. Slide the front PCB corners under
two fixed retainers, then lower and screw down the rear. Each retainer needs a
**2 × 1.2 mm component/wire-free corner zone** on both faces of the PCB; check
the right corner against the existing wire routing. Retainers allow 0.4 mm
above the nominal 1.6 mm PCB. The fit frame includes these retainers; do not
force the board underneath them.

Print the two small tests first, then one of each case part, as oriented,
at 100% scale: 0.2 mm layers, four walls, 30–40% infill, no supports.
Use four **3 × 10 mm** lid screws and one **3 × 6 mm** rear PCB screw, pan-head thread-forming types
intended for thermoplastic, after checking the pilot coupon and the screw
maker's pilot guidance. Default pilots are 2.5 mm; ordinary machine screws
need tapped holes. PETG is suitable for first fitting; choose the final
material for the measured cabin location temperature. Keep it out of direct
sun, secure cables externally, and leave the antenna area clear of metal.
The owner confirmed the bottom offsets; the complete V3 lid/panel fit remains
to be checked. This vented prototype is unsealed. For downloads, slicing and
regenerating local print packs, see [Printed cases and mounts](printing.md).
The future SD breakout is not accommodated until its mounting layout is known.

### Electronics

| Item | Selection |
| --- | --- |
| ESP32 | Owner's WROOM-32 board, with USB power and exposed headers |
| CAN transceiver | [Adafruit CAN Pal 5708](https://www.adafruit.com/product/5708), $3.95 listed October 15, 2026 |
| External SD slot, later | [Adafruit SPI/SDIO breakout 4682](https://www.adafruit.com/product/4682), $3.50 listed October 15, 2026; use SPI mode |
| Card, later | 16/32 GB high-endurance microSD, FAT32; appropriate temperature rating |
| Power | Owner's existing regulated 5V USB-C converter on switched power |
| Small parts | Optional activity LED and spare 1k resistor; stop button for future SD recording |
| Assembly | Soldered wiring, enclosure, fused power harness and strain relief |

Prices exclude card, power, wiring, tax and shipping. No additional ESP32 or
MCP2515 CAN-controller board is needed. This pin plan does not apply to C3/S3
boards or a bare WROOM radio module without a development-board carrier.

## Board wiring

Use GPIO numbers, not header position numbers. Confirm the actual development
board's labels and 3.3V regulator capacity before assembly.

| ESP32 | Connect to |
| --- | --- |
| 3V3 / GND | CAN Pal Vcc / GND |
| GPIO26 | CAN Pal TX |
| GPIO27 | CAN Pal RX |
| GPIO34 | Leave unconnected; ignition sensing is disabled |
| GPIO25 | Optional LED anode; LED cathode through 1k to GND |

**Future SD only:** these connections are not needed for the live web page.

| ESP32 | SD breakout / control |
| --- | --- |
| 3V3 / GND | Breakout 3V / GND |
| GPIO18 | SD CLK |
| GPIO19 | SD SO / D0 / MISO |
| GPIO23 | SD SI / CMD / MOSI |
| GPIO13 | SD CS / D3 |
| GPIO32 | Optional normally open safe-stop button to GND |

Keep future SPI wiring short, initially under about 10 cm. Neither the SD
breakout nor ESP32 GPIO can accept 5V or vehicle 12V.
The default firmware does not read GPIO34, so no ignition pull-down or relay is needed.
Optional LED: steady = recent CAN traffic or SD recording, blinking = CAN
initialization/storage fault, off = idle. Missing/disabled storage is not a fault.

CAN Pal SLNT goes to GND. Connect H/L and the reference-ground conductor to
the existing custom telemetry bus. Use a short branch or place the logger at
the cabin end of the main cable. There must be **two 120-ohm terminators total**,
one at each physical end, regardless of device count. If the logger replaces
the U2C as the far end, enable its CAN Pal terminator and remove U2C termination
when the U2C joins as an intermediate node. With everything unpowered, expect
approximately 60 ohms H-to-L. The logger has no connection to coil negative,
GlowShift signals or vehicle control circuits.

## USB power and recording

Use the owner's existing regulated **5V USB-C converter**, with a cable matching
this ESP32 development board's USB connector. Feed the converter from a fused
ignition-switched circuit so the logger turns off while parked. A supply capable
of at least 1A provides useful margin; test the actual board with Wi-Fi and SD
writes active. Keep this separate from the engine node's proposed low-current
power stage. Feed the ESP32 through USB, never apply 5V to its 3V3 pin, and avoid
paralleling vehicle USB power with PC USB power when flashing.

`UseIgnitionSense = false` and `EnableSd = false` are the selected defaults.
Live capture begins on power-up. Optional SD recording begins after card
initialization whenever USB power is present. It does not wait for an
ignition signal. An always-powered USB outlet would also keep the logger on
while parked, contrary to the chosen operating mode. No relay, ignition-sense
resistor/capacitor or delayed-off power supply needs to be purchased for this setup.

Live-only mode writes no telemetry to flash or SD. All RAM history disappears
at power-off. With SD enabled, the logger flushes about once per second, but **abrupt power loss can lose
recent data or corrupt the SD card/filesystem**; supply stability during normal
operation does not provide time to finish a write after power disappears. The
owner accepts this simpler power arrangement for the logger. Before deliberate
USB disconnection, hold the stop button until `ready_for_power_off` is true:
this stops new SD enqueues, drains the queue, closes the CSV and saves health
counters. Live reception and RAM snapshots continue.
The button cannot automatically predict key-off. An ordinary abrupt key-off
may therefore leave no shutdown-health JSON for that boot.

Separate ignition sensing remains an optional future mode in the firmware.
Enabling `UseIgnitionSense` requires a protected 0/3.3V signal on GPIO34, an
external pull resistor, and continued power after the ignition signal drops.
It is disabled in this build; no vehicle voltage should reach GPIO34.

## Build and flash

Install Arduino CLI (**1.4.1** is used in CI) and the official
**esp32:esp32 core 3.3.6**. No third-party Arduino libraries are needed.
From the repository root, build and list the connected serial ports:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.6 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir .cache/esp32-logger esp32-logger/van_can_logger
arduino-cli board list
```

Replace `COM5` below with your actual board port, then upload and open the
serial monitor. Close other serial monitors before uploading.

```sh
arduino-cli upload --fqbn esp32:esp32:esp32 --port COM5 esp32-logger/van_can_logger --input-dir .cache/esp32-logger
arduino-cli monitor --port COM5 --config baudrate=115200
```

Replace `COM5` with the actual serial port; Linux typically uses `/dev/ttyUSB0`.
Disconnect vehicle power for PC-powered flashing. USB driver/port access depends
on the existing board. The default generic ESP32 target assumes a compatible
classic development board; confirm its flash size before flashing.

To use a matching `esp32-logger-<commit>` Actions artifact instead of compiling,
extract its files into `.cache/esp32-logger`, install the same core, then use
the upload command above. Verify its SHA256SUMS first; do not flash the STM32
BIN or the ESP32 application BIN alone as though it were a complete image.

The owner's `.cache/esp32-logger/` and `.cache/esp32-logger-recovery.zip` are
local, ignored recovery copies, not prerequisites or files supplied by a clone.
Rebuild or download the matching artifact if they are absent. Never publish
the local serial capture containing the device Wi-Fi password.

On each boot the device advances a persistent boot counter. At first setup it
stores a generated 16-character
Wi-Fi password in NVS. Read the SSID/password at 115200 baud and save them.
Join `VanCAN-xxxxxx`, stay connected when the phone warns of no internet, then
open **http://192.168.4.1**. Only people with the hotspot password should join:
HTTP has no separate login. The gateway exposes status and downloads only;
there is no remote CAN transmission or arbitrary filesystem access.

## Add continuous SD recording later

Install the SPI breakout and FAT32 card, set `EnableSd = true` in
[logger_config.h](../esp32-logger/van_can_logger/logger_config.h), rebuild and flash.
Live monitoring and RAM export remain available if card initialization fails.
The physical stop button affects SD recording only; it does not stop live capture.

The active SD CSV is downloadable after it closes or rotates. Hold the stop button
until status says safely stopped and `ready_for_power_off` is true to retrieve a
short session without waiting for rotation. Release the button, then cycle USB
power to resume. Do not remove the card while powered. A storage fault latches
recording off until restart; it does not silently format the card or overwrite
an existing session. Back up/remove old files if NVS is erased and filenames collide.

## Log format and limits

Files use `/logs/B00000001-S0001.csv`, with a persistent boot number and segment.
Columns: `timestamp_us,sequence,id,extended,rtr,dlc,data`. Timestamp is 64-bit
microseconds since this ESP32 boot, measured when the application receives the
frame, not the physical CAN arrival time or calendar/UTC time. There is no RTC/GPS
clock yet. Identifier and payload are hexadecimal; RTR payloads are empty.
Sequence increments on every received frame, including while not recording.
This format is distinct from Android CSV; existing playback/import is not implied.

`/api/live` provides coolant/fuel/heartbeat snapshots, per-channel ages, diagnostic
counters and the newest 32 raw frames. `/recent.csv` snapshots the RAM ring
without holding the receive lock while HTTP sends data. Browser display polling
is every 500 ms; received-frame timestamps are independent of that polling.
Displayed trends are sampled in the browser, not stored trip histories.

`/api/status` exposes recording state, free space, queue drops, driver missed/
overrun counts, bus errors/state, and storage errors. A safe stop saves a
`Bxxxxxxxx-health.json` on the card for later inspection with a card reader.
The logger is aimed at this low-traffic telemetry network, not lossless capture
of a busy factory bus. Reception/download/SD scheduling and heat must be tested
on the actual board. There is no TCP CAN forwarding or web-based CAN transmission.

## Bench acceptance before permanent installation

1. With power off, inspect all wiring and prove no vehicle voltage reaches GPIO.
   Leave SD disconnected and power only by USB at first.
2. Leave GPIO34 unconnected. Apply USB power, join the hotspot, and confirm
   Live only mode without an SD error. The activity LED should light with CAN traffic.
3. Export the recent CSV and check heartbeat `0x100` and
   coolant `0x110/0x111` against the laptop monitor and known payloads.
4. Connect only STM32 and logger with correct termination, remove the U2C,
   and confirm the logger supplies ACKs and the STM32 keeps transmitting.
5. Monitor while repeatedly exporting recent CSV; verify sequences and
   that queue-drop, driver-missed and storage-error counters stay at zero at
   the intended traffic rate. Unplug CAN and confirm each sensor/heartbeat goes
   stale; disconnect Wi-Fi and confirm values clear. Change units and filter/freeze
   the raw-frame view. The RAM buffer should wrap without growing its allocation.
6. Later with SD enabled: test missing/full/removed card, safe-stop latching,
   power-cycle restart, and log rotation. On a
   disposable test card, verify oldest-log deletion under low space and inspect
   files after repeated abrupt power cuts; copy important logs off the card.
7. Test the existing converter with this load. Verify startup, crank behavior,
   that USB power switches off while parked, and a warm cabin soak.
   Check 3.3V stability with Wi-Fi and SD writes active. Use soldered connections,
   secured card, insulated mounting and antenna clearance before installing.

## Troubleshooting

| Symptom | Next check |
| --- | --- |
| No serial port | Use a data-capable cable; check the board's USB-UART driver and OS port permissions |
| Port busy | Close Arduino/terminal serial monitors and other flash tools |
| Wrong boot mode / cannot connect | Hold BOOT while starting upload; release once writing begins. If needed, hold BOOT, tap EN/RESET and retry |
| Reset circuit still defeats manual boot | Run the upload with `--verbose`, save the printed esptool command, enter bootloader manually, then rerun that command with `--before no-reset` in place of `--before default-reset` |
| Flashed but no application output | Release BOOT, tap EN/RESET, open the serial monitor at 115200 baud |
| Hotspot password unknown | Read startup serial output; credentials belong to this board, not the example COM8 board above |
| Phone leaves the hotspot | Choose to stay connected without internet and open `http://192.168.4.1` explicitly |
| Web page works but no CAN | Check GPIO26/TX, GPIO27/RX, 3.3V supply, SLNT/GND, reference ground, 500 kbit/s and two terminators total |
| One reading stale/faulted | Check that sensor's `0x110`/`0x111` frames and engine-node input; Wi-Fi/SD do not create missing sensor data |
| SD error after opting in | Check `EnableSd`, SPI wiring, 3.3V power and FAT32; return to `EnableSd = false` for cardless use |

Manual entry is documented in [Espressif's boot-mode guide](https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/boot-mode-selection.html).
The no-reset retry is for a board already placed in its bootloader, not a
reason to erase NVS or reinstall firmware when only the hotspot needs joining.

## Customize the Wi-Fi dashboard

Tap **Edit layout** above the cards. Use **↑** / **↓** to move a card, or
**Remove** to hide it. **Add card** restores any hidden card at the end of the
list. **Done** hides the editing controls, and **Reset layout** restores the
default selection and order. All cards may be removed; the empty page keeps an
**Add card** button available.

The two coolant sensors and fuel level have separate cards. **Engine & capture
status** and **Raw CAN frames** are also optional cards. On wider screens, the
coolant cards can share a row; fuel and utility cards span the width. Order runs
left-to-right and then top-to-bottom. Hiding or moving cards does not change
sampling, freshness/fault checks, raw-frame freezing, RAM CSV capture or SD logging.

Layouts save in browser storage on that phone/browser for the gateway address.
They survive page reloads and ESP32 restarts, but clearing browser/site data resets
them. Android app layouts save separately and are not synchronized with browser
layouts. If browser storage is blocked/full, the editor reports that changes
last until reload; live readings continue to work.

Desktop and phone browser checks use clearly marked simulated telemetry.
The October 17 fuel/card-editor firmware has now been flashed and verified on
the ESP32; its startup log confirms the hotspot and dashboard address.
Live sensor acceptance still awaits the bench harness.

The October 17 card-editor build compiled with core 3.3.6 (77% program storage,
19% static RAM). Its local output is `.cache/esp32-logger-dashboard`; the prepared
`.cache/esp32-logger-dashboard-update.zip` contains the four normal flash regions,
source/artifact hashes and instructions, excluding the full-flash merged image.
The four regions were written and their hashes verified on October 17.
NVS was preserved. After correcting the pull-down connection to **P12/GPIO12**,
flash identification succeeded at 3.3V with 4MB detected. Manual BOOT/reset
was used before the upload with automatic reset disabled. Subsequent startup
confirmed `VanCAN-1F8A3C` and `http://192.168.4.1`, with no fatal startup message.
Keep the GPIO12 pull-down correctly connected for the current hardware setup.

## Primary references

- [Espressif TWAI driver](https://docs.espressif.com/projects/esp-idf/en/v5.5.2/esp32/api-reference/peripherals/twai.html): controller modes, queues and external transceiver requirement.
- [Espressif Arduino core 3.3.6](https://github.com/espressif/arduino-esp32/releases/tag/3.3.6): pinned build dependency.
- [CAN Pal pinout](https://learn.adafruit.com/adafruit-can-pal/pinouts): logic supply and selectable 120-ohm termination.
- [SD breakout pinout](https://learn.adafruit.com/adafruit-microsd-spi-sdio/pinouts): SPI signals and 3.3V-only connections.


## Fuel support flashed — October 17, 2026

The current sketch adds fuel CAN `0x120` without changing pins, power, SD mode
or stored Wi-Fi credentials. Update both the Nucleo firmware and the ESP32
sketch to see fuel. The October 17 ESP32 update includes this feature and the
card editor. Successful programming/startup does not establish live fuel
accuracy; the Nucleo-to-gateway test awaits the bench harness.

`/api/live` adds a `fuel` object containing `seen`, `valid`, `status`, `sequence`,
`adc`, `resistance_deci_ohms`, `age_ms` and `estimated_percent`. Invalid readings
use JSON `null` for the estimated percentage. Version, sender identity, length,
raw-count limits and 5–100-ohm diagnostic margins match Android.

The ESP32 damps valid percentages using CAN receive timestamps and a five-second
time constant. HTTP polling does not advance the filter. Raw resistance/count
and derived nominal-3.3V voltage are not damped. Faults hide level immediately;
stale gaps and fault recovery reset smoothing. Browser fuel values clear on
CAN failure, gateway loss or a 1.5-second fuel timeout independently of coolant.
The **Fuel level** raw-frame filter and existing freeze controls affect the table
only, not live readings or CSV capture.

For a local build prepared in `.cache/esp32-logger-fuel`, upload with the same
board/port selection as above and `--input-dir .cache/esp32-logger-fuel`. This
folder is a local artifact, not a tracked dependency. No erase operation is
needed; normal sketch upload retains NVS credentials. Live fuel hardware and
browser acceptance tests remain pending until the updated devices are connected.
