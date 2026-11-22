# Ford 400M RPM input — CoilX selected

[Hardware](hardware.md) · [Wiring diagram](../hardware/rpm-input/schematic.svg) ·
[Parts list](../hardware/rpm-input/bom.csv) ·
[Connection list](../hardware/rpm-input/connections.csv)

Use the **Autosport Labs CoilX** for the stock single-coil distributor ignition.
This replaces the earlier custom optocoupler/monostable build. Selection is
confirmed; the owner received CoilX on October 30, 2026 and reports it wired
on November 10. The MCU lead is not connected yet; powered acceptance remains pending.

**Signal path:** coil negative → CoilX → 5V/3.3V level-shifter → STM32
→ CAN → Android dashboard. The November 10 source adds D5/PB4 timer capture,
CAN `0x130` and Android app **0.4.0**. Electrical pulse/vehicle acceptance is
still pending. The laptop dashboard also reads RPM directly over ST-Link USB
without any CAN network. The ESP32 dashboard does not yet decode RPM.

## Selected modules

- [CoilX](https://www.autosportlabs.com/product/coilx-rpm-input-adapter/): factory-built ignition conditioner with optical isolation and filtering.
- [Adafruit 757 BSS138 level converter](https://www.adafruit.com/product/757):
  proposed low-voltage interface. The PCB is assembled; headers are supplied
  loose and require soldering, or the wiring can be assembled by a supplier/helper.
  This is a digital pulse interface, not a pressure-sensor voltage converter.

### Remaining supplies

- One Adafruit 757 level converter; DigiKey **1528-1007-ND**, listed at
  **$3.95** on October 15, 2026:
  [product listing](https://www.digikey.com/en/products/detail/adafruit-industries-llc/757/4990756).
  [Add one converter to the existing DigiKey cart](https://www.digikey.com/classic/ordering/fastadd.aspx?part1=1528-1007-ND&qty1=1).
  This link adds only the converter; it does not place an order.
- A protected, regulated **5V** supply shared with the engine node, plus its
  **3.3V** logic rail for the converter. Verify the existing supply before buying
  another regulator; never power CoilX from vehicle 12V.
- Suitable insulated wire, coil-terminal connection, heat shrink and strain
  relief. Check whether the purchased CoilX version includes wire pigtails.

No additional pressure-board amplifier, resistor or capacitor assortment is
required for this RPM interface. The level converter still needs bench validation.

CoilX needs regulated 5V and outputs 5V logic. The level converter supplies a
3.3V signal to the receiving MCU. Its suitability at this low pulse rate is an
engineering inference from the converter's digital-interface specification;
verify pulse shape and counting on the bench. Never put raw coil voltage on
this level converter or an MCU pin.

## Wiring

Use connector identity **and** wire color: CoilX uses different color meanings
on its two sides. Confirm the supplied module matches the
[manufacturer wiring guide](https://wiki.autosportlabs.com/CoilX).

| Module connection | Connect to |
| --- | --- |
| CoilX 2-wire side: red, coil signal | Coil primary negative |
| CoilX 2-wire side: black, external ground | Engine/ignition ground reference |
| CoilX 3-wire side: yellow, power | Protected regulated 5V |
| CoilX 3-wire side: red, data-system ground | C2 cavity 9 → STM32 logic ground |
| CoilX 3-wire side: black, signal output | C2 cavity 4 → level converter B1 (5V logic side) |
| Level converter HV | Same regulated 5V |
| Level converter LV | STM32 3.3V rail |
| Level converter GND pins | STM32 logic ground |
| Level converter A1 (low-voltage logic side) | **Nucleo D5 / PB4 (CN9 pin 6), TIM3 channel 1** |

Leave unused converter channels open. A1/B1 are one matched channel, not
physical connector cavity numbers. C2 cavities 4/9 are now allocated to RPM
in place of deferred high-pressure fuel. CoilX needs a third conductor for
regulated 5V: no supply cavity is free on C2, so that feed and any added
connector await enclosure-layout planning. Keep raw coil-side wiring outside
the logic/sensor harness. PA0/PA1 coolant, PB12 fuel and PA11/PA12 CAN stay
allocated. Converter **A1** is a channel name: do not connect it to Nucleo
Arduino **A1**, which already belongs to post-radiator coolant. Older assembly
drawings label this lead as a future timer GPIO; its destination is now D5/PB4.

Keep coil-side wiring insulated and secured away from logic wiring. Use the
manufacturer's heat-shrink/enclosure arrangement and provide strain relief.
Use the engine node's protected regulated supply; vehicle 12V does not go to
CoilX or the level converter. Optical isolation of the signal does not establish
complete isolation of grounds elsewhere in the vehicle.

## Bring-up and remaining work

### EPLZON carrier mounting

Use the known 38.1 × 50.8 mm EPLZON outline and preserve its two central
3.2 mm holes, 40.6 mm apart. The local assembly map reserves 8 mm diameter
screw-access zones, 6 mm post-contact areas, and the alternative holder's
5 × 5 mm corner contacts. Header placement is now **E5–E10 / G5–G10**;
the previous rows 3–8 placement conflicts with upper mounting-hole access
when the actual Adafruit PCB body outline is included. LV/HV face row 5,
both GND pads face row 10, and the underside ground jumper is **D10–H10**.
All lead holes shift down by two rows accordingly. Component pad names and
C2 assignments are unchanged. Mechanical checks use the existing case CAD
and Adafruit PCB outline; grid-to-edge registration, physical fit and powered
acceptance still need confirmation. The printed holders provide 6 mm under
the carrier; keep projections below 4 mm to retain the documented 2 mm margin.

### Electrical bring-up

1. Before coil connection, verify module identity, wiring and 5V/3.3V supplies.
2. Test the converter separately using a 0–5V digital source into B1. At
   100/200/400Hz, verify one 0–3.3V pulse per input pulse at A1. This corresponds
   to 1500/3000/6000 RPM for this single-coil four-stroke V8.
3. Connect CoilX following its guide. Check its conditioned output and the
   translated output for one count per firing, then compare against an
   independent RPM reference. Use suitable ignition-rated equipment if checking
   the coil waveform; never attach an ordinary scope ground to coil negative.
4. Follow the Android acceptance sequence below. Confirm actual pulse shape,
   edge polarity and one firing event per captured edge before accepting vehicle RPM.

There are four firing events per crank revolution: `RPM = pulse Hz × 15`.
CoilX's output polarity and usable capture edge should be verified during
bring-up; the old custom circuit's 1ms pulse-width assumption no longer applies.
The jumping existing tach may indicate an ignition or grounding problem that
an adapter cannot repair.

## November 10 test preparation

The pin assignment is verified against [ST UM2324, Table 12](https://www.st.com/resource/en/user_manual/um2324-stm32-nucleo64-boards-mb1360-stmicroelectronics.pdf):
**D5 = PB4 = TIM3_CH1, CN9 pin 6**. Firmware uses rising-edge input capture at
100 kHz (10 µs/count), four pulses/revolution and a 500 ms pulse timeout.
The short timer input filter suppresses sub-microsecond glitches; it does not
replace CoilX conditioning or establish ignition-noise immunity. Periods faster
than 10,000 RPM report a range fault; this is a diagnostic bound, not a safe
engine speed. Period measurement supports cranking speeds; timer wrap and long
stops are handled separately. No new output or engine-control function is added.

### Direct USB test — current bench setup

The CAN network remains installed in the van, so the current bench test uses
**Nucleo ST-Link USB → laptop**. No U2C, CAN Pal or second CAN node is required.
The firmware mirrors the RPM reading over USART2 TX/PA2 through the board's
factory ST-Link VCP link at **115200 baud, 8-N-1**. The stream continues when
CAN transmission cannot complete; it uses its own sequence counter. It accepts
no serial commands. This validates RPM acquisition and USB telemetry, not CAN.

1. Connect the Nucleo ST-Link USB to Windows. Windows assigned
   **COM7** during bench preparation, though port numbering can change.
2. From the repository, run `start_rpm_dashboard.bat`. It automatically finds
   a single ST-Link VCP, opens **http://127.0.0.1:8765**, and records every sample
   to a new CSV under `.cache/rpm-logs`. Close other serial monitors first.
   If more than one Nucleo is connected, use the explicit command:

   ```powershell
   .\.venv\Scripts\python.exe tools\can_dashboard.py --serial COM7
   ```

3. The page should say **Nucleo USB live**, show increasing sample count and
   node uptime, and show **NO SIGNAL** while D5/PB4 receives no pulses. USB
   samples are explicitly labeled separately from CAN traffic.
4. With power off, connect level-shifter **A1 → D5/PB4**, with LV=3.3V and logic
   ground connected. Restore power and use the electrical test points below
   if a suitable pulse source is available. The 100/200/400 Hz expectations
   are the same in the USB dashboard. A connected, stationary CoilX does not
   generate ignition events by itself; no-signal is expected without a source.
5. Stop pulses: the value clears within approximately one second. Disconnect
   Nucleo USB: the number clears and the page reports disconnected; reconnect
   resumes acquisition and logging. The reader retries automatically. The
   CSV retains host UTC time, MCU uptime, status, sequence, RPM, frequency,
   period and raw payload, including invalid/missing-signal samples.
6. To end a session started with the batch file, press Ctrl+C in its terminal.
   Closing the browser alone leaves acquisition/logging running.

Raw diagnostic lines have the form `RPM <uptime_ms> <16 hex payload digits>`.
The payload matches the eight-byte RPM CAN format, but its sequence is local
to USB; it is not evidence that a CAN frame was received or acknowledged.

### Android acceptance sequence

1. Install the locally built **Van CAN 0.4.0** APK as an update. Existing saved
   layouts are preserved: use **Edit layout → Add card → Engine RPM**, then
   move it to the top. New/default layouts already include the card.
2. With power off, connect the level converter **A1 low-side output to D5/PB4**.
   Confirm LV=3.3V, HV=5V and common logic GND. Never route CoilX's 5V output
   directly to D5 or feed 12V into CoilX. Avoid back-powering an unpowered MCU.
3. Use the established USB-powered Nucleo setup. Connect U2C to the Android
   USB host and the terminated 500 kbit/s CAN bus; keep its V+ unconnected.
   Grant USB permission and check heartbeat/coolant/fuel remain present.
4. Without ignition pulses, raw CAN must show **`130` about ten times/second**,
   and Engine RPM must show **NO PULSES**, not a stale old RPM. Healthy total
   traffic is approximately **22 frames/second** including existing sensors.
5. Press **START LOG**. For a low-voltage bench check, disconnect CoilX's
   output from B1 before applying a 0–5V square-wave source to **B1**. Never
   drive two outputs together. The translated A1/D5 signal must stay within
   0–3.3V. Do not apply this test source to CoilX's raw ignition input.

   | Source at B1 | Expected Android RPM | Expected pulse frequency |
   | --- | --- | --- |
   | 100 Hz | 1500 | 100 Hz |
   | 200 Hz | 3000 | 200 Hz |
   | 400 Hz | 6000 | 400 Hz |

   These are electrical simulation points, not requested engine operating speeds.
   Timer quantization is 10 µs; compare against the source's measured frequency.
6. Stop the source: **NO PULSES** should replace the number within roughly
   one second (500 ms timeout plus CAN/UI scheduling). Resume: two clean
   rising edges are required. Disconnect CAN: the card instead becomes
   **STALE / NO CAN DATA** after 500 ms without an RPM frame, plus UI scheduling.
   Other live sensor traffic must not keep an old RPM value fresh.
7. Power down, remove the test source and reconnect CoilX to B1. For the first
   supervised vehicle check, log cranking and idle and compare with an independent
   tach/reference. Confirm one pulse per firing; do not infer calibration from
   an already erratic tach. Stop logging and **EXPORT** the CSV for review.

`NO PULSES` cannot distinguish a stopped engine from disconnected wiring.
`ACQUIRING` means the first edge arrived but no complete period exists yet.
`OUT OF RANGE` means an implausibly short period; `CAPTURE OVERRUN` means the
capture register was overwritten before service. Faults suppress the displayed
number. USB disconnection and stale RPM frames also suppress it independently.
The app logs raw `0x130` frames automatically, including faults and sequence.

Software checks cover capture arithmetic, rollover, timeout/restart, overcapture,
CAN byte encoding, malformed payloads, Android freshness and saved layouts.
They do not replace the bench/vehicle checks above. Record APK/firmware hashes,
measured rails and pulse frequency, independent RPM reference and exported CSV
with the test result.
