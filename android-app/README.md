# Van CAN Android dashboard

Native, receive-only Android dashboard for the van's project-owned CAN network.
It connects directly to the BTT U2C over Android USB Host, so the first version
does not require a laptop or Raspberry Pi in the vehicle.

New builds should start with [Getting started](../docs/getting-started.md) for
the engine node, sensor circuits and receiver choices. For viewing in a browser
without a USB-host connection to the phone, use the separate
[ESP32 Wi-Fi gateway](../docs/esp32-logger.md).

## Current capabilities

- Direct GS_USB/candleLight connection to the U2C at **500 kbit/s**.
- Decodes engine heartbeat `0x100`, pre-radiator coolant `0x110`, and
  post-radiator coolant `0x111` (both TX3 sensors), and fuel level `0x120`.
- Shows independent temperature and fuel cards in a saved, customizable layout.
  Cards stack on phones and fill two columns in wide landscape, in priority order.
  Fault and stale status remain independent for each sensor.
- Shows a fuel card with raw resistance/voltage/count and a smoothed, explicitly
  **uncalibrated** 75-ohm-empty / 10-ohm-full estimate; faults hide level immediately.
- Shows coolant in °F/°C, ADC count, estimated signal voltage, node uptime,
  frame rate, heartbeat sequence, and recent raw CAN frames.
- Records every received frame to CSV and exports it with Android's document
  picker.
- Responsive custom dashboard for a phone in portrait or the ESSGOO display in
  landscape.
- System-bar and camera-cutout spacing, larger phone readings and controls,
  compact sensor/node cards, and scrolling when the window is too short.
- Add/remove cards and move them up/down with native, accessible layout controls.
  The selection and order survive app restarts; hidden cards keep receiving/logging data.
- Requires no Google services and no third-party runtime library.

The application never submits a CAN data frame. The U2C is deliberately started
in normal CAN mode—not listen-only—because it must provide the CAN ACK bit when
the Nucleo and U2C are the only two active nodes.

## Open and run it

### Install a built APK

From a successful GitHub Actions run, download `android-debug-<commit>` and
extract `app-debug.apk` (see [build downloads](../docs/automation.md#download-a-build)).
Copy the APK to the phone, open it, and allow installation from that source
when Android prompts. This is a debug/test app, not a Play Store release.
The supported minimum is Android 8.0 / API 26.

To update an existing installation, the signing key must match. If Android
reports a signature conflict, export any logs before uninstalling the old app:
uninstalling removes its private files. See [debug signing](../docs/automation.md#android-signing-for-repeated-phone-updates).

### Build from Android Studio

1. In Android Studio, select **Open** and choose the `android-app` directory.
2. Allow the initial Gradle sync to finish.
3. On a phone supporting wireless debugging, enable **Developer options → Wireless debugging**.
4. In Android Studio, choose **Pair Devices Using Wi-Fi** and pair the phone.
5. Select it as the run target and press **Run**. A USB debugging connection
   can also install the app; disconnect it before attaching the U2C.

Wireless debugging keeps the Pixel's USB-C port free for the U2C. The generated
debug APK is at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## First hardware test

1. With power off, verify approximately 60 Ω between CAN-H and CAN-L on the
   complete, terminated bus.
2. Connect the U2C to CAN-H, CAN-L, and the bus reference/ground used by the
   existing bench setup. Leave the U2C `V+` terminal disconnected.
3. Disconnect the U2C from the laptop.
4. Connect it to the Pixel using a known data-capable USB-C cable. If a direct
   cable does not put the phone into USB-host mode, use a USB-C OTG/host adapter.
5. Launch **Van CAN** and grant the Android USB permission prompt.
6. Power the Nucleo setup. The status should progress from `U2C ONLINE · WAITING
   FOR CAN` to `CAN ONLINE · 500 KBIT/S` and the raw-frame list should show
   `100`, `110`, `111`, and `120` with current firmware. Fuel hardware
   must be connected separately; a floating A5 is not a valid sender reading.

Both channels were confirmed operating in the October 5–6, 2026 bench session;
this does not establish ESSGOO compatibility or calibrated temperature accuracy.
Each card hides stale temperatures after 1.5 seconds without its own message.
An absent sensor with its pull-up installed should report OPEN without
interrupting the other channel. See the [bench test](../docs/bench-setup.md#second-coolant-channel).

Do not connect vehicle 12 V to any U2C USB or `V+` pin. The U2C is powered from
the Android USB host for this arrangement.

## Customize your dashboard (app 0.3.0+)

1. Tap **Edit layout** beneath the connection/log/export controls.
2. Use **↑** and **↓** on a card to change its priority. In wide landscape the
   order runs left-to-right, then top-to-bottom.
3. Tap **Remove** to hide a card. Tap **Add card** to restore a hidden card at
   the end of the dashboard, then move it to the desired position.
4. Tap **Done** to hide the editing controls. Changes save as you make them;
   rotation and app restarts keep your selection and order.

Pre-radiator coolant, post-radiator coolant, fuel level, engine status and raw
CAN frames can all be managed independently. **Reset layout** restores their
original order and visibility. You may remove every card; the empty dashboard
keeps an **Add card** button so you can recover it. Sensor faults or missing CAN
messages do not remove cards or change your saved layout. Hiding a card only
changes the display; every received frame is still available for CSV logging.
The [ESP32 Wi-Fi dashboard](../docs/esp32-logger.md#customize-the-wi-fi-dashboard)
also supports card layouts after its firmware update; its browser layout saves
separately from the Android app.

These controls select supported readings; arbitrary CAN IDs, pressure and RPM
decoding are not added by creating a dashboard card.

## Logging

Press **START LOG** to create a CSV in the app's private external-files folder.
Press **STOP LOG** to finish it. **EXPORT** opens Android's document picker and
copies the latest log to a location you choose. Export also safely stops an
active log first.

Both coolant IDs and fuel ID `0x120` are included automatically in the raw-frame CSV; no separate
logging channel needs to be enabled for either additional sensor.

## Reading the dashboard

| Display | Meaning |
| --- | --- |
| Pre-radiator / `0x110` | Sensor 1, engine outlet, A0/PA0 |
| Post-radiator / `0x111` | Sensor 2, radiator outlet, A1/PA1 |
| Fuel level / `0x120` | Isolated FG72A sender on A5/PB12; original dash gauge disconnected |
| Fuel % EST. | Five-second damping of a provisional 10–75-ohm interpolation; not calibrated tank volume |
| Fuel Ω / ADC / V | Resistance from firmware; unsmoothed ADC and nominal 3.3V voltage estimate |
| Fuel OUT OF RANGE | Resistance outside diagnostic 5–100 ohms; no fuel percent displayed |
| °F / °C | Firmware-calculated temperature, not independently calibrated by the app |
| ADC / V | Averaged raw ADC count and voltage estimated using a nominal 3.3 V reference |
| VALID | Fresh message with valid protocol, identity, ADC range, and no sensor fault |
| OPEN / SHORT | Firmware input fault; temperature is hidden |
| ADC ERROR / CALC ERROR | Acquisition or conversion failed; temperature is hidden |
| STALE / NO DATA | No fresh message for this sensor, or USB is disconnected |
| Engine node | Heartbeat status, node uptime, frame count/rate, heartbeat sequence |
| Raw CAN | Recent frames, including `100`, `110`, `111`, and `120` |

The header reports overall traffic; one healthy sensor does not establish that
the other is fresh. With current firmware, expect roughly twelve received frames/second.
The controls are **Connect/Disconnect**, **Start/Stop log**, **Export**, and
**Edit layout**. Connection and layout controls are above the cards; scroll to
reach lower-priority cards on shorter screens. No fan or
engine-control commands are implemented by this app.

## Troubleshooting

| Problem | Check |
| --- | --- |
| U2C not detected | USB data cable, host/OTG mode, supported USB identity, and connection to this device rather than the PC |
| USB permission denied | Reconnect, press CONNECT, and grant Android's USB permission |
| U2C online but waiting for CAN | Node power, shared reference, 500-kbit/s bus, wiring, and termination |
| Only pre-radiator appears | Install the two-card app build; flash the two-channel firmware and check for `111` in Raw CAN |
| Fuel has no data | Flash current firmware and install app 0.2.0 or newer; check raw ID `120` |
| Fuel OPEN / OUT OF RANGE | Check the 1k pull-up, dedicated return, old-gauge disconnection and A5 routing to PB12 |
| Post-radiator shows OPEN | Check sensor 2 wiring/return and its separate divider; an installed pull-up without a sensor produces OPEN |
| One card becomes stale while the other updates | Check whether that channel's CAN ID continues arriving; freshness is independent |
| Works on phone but not PC | Move the U2C to the PC and restart the [Python dashboard backend](../tools/README.md#restart-after-updating-the-code) |
| APK will not update existing app | Check signing-key compatibility; export logs before any uninstall |
| Head-unit USB works for Android Auto but not Van CAN | The vendor may reserve that port; ordinary app USB Host access is not yet confirmed |

For resistance/continuity checks, remove power first and follow the
[bench guide](../docs/bench-setup.md). A functioning display does not validate
automotive power protection or temperature accuracy.

## ESSGOO head-unit test

Build and verify on the Pixel first, then copy/install the same APK on the
ESSGOO unit. Android version differences are covered by the app's API 26 minimum.
The remaining unknown is whether the ESSGOO firmware exposes its rear Android
Auto USB port to ordinary USB Host applications. The app will show `U2C not
detected` if that port is reserved by the vendor firmware.

## USB identities

Automatic detection currently accepts the two standard GS_USB identities:

| VID:PID | Family |
| --- | --- |
| `1D50:606F` | Geschwister Schneider / common GS_USB |
| `1209:2323` | candleLight |

If the BTT firmware reports a different identity, capture it with Android's
USB Device Info app or `adb shell dumpsys usb`, then add it in both
`GsUsbCanAdapter.isSupported()` and `res/xml/usb_device_filter.xml`.

## Project layout

- `MainActivity.java` — permission, USB lifecycle, decoding, logging, export.
- `usb/GsUsbCanAdapter.java` — direct GS_USB control and bulk transfers.
- `protocol/VanCanDecoder.java` — project CAN payload decoder.
- `DashboardView.java` — responsive sensor cards and native layout controls.
- `DashboardLayout.java` — stable card IDs, ordered selection and saved-layout validation.
- `logging/CsvCanLogger.java` — raw-frame CSV logger.


## Fuel-level bench test

Use the [isolated fuel-level circuit and resistor tests](../docs/fuel-level.md)
before connecting the installed sender. Firmware assumes a **1k measuring
pull-up**, a 1k ADC series resistor, a 100nF output filter, and A5 routed to
PB12/ADC1_IN16. The old gauge must be electrically disconnected.

The fuel card shows voltage and resistance immediately; only the percentage
is damped with a five-second time constant. It hides level immediately on a
fault, after 1.5 seconds without its own frames, or when USB disconnects.
Its amber low-end bar is only an estimate, not a calibrated low-fuel alarm.
Wire/contact resistance, sender nonlinearity and the custom tank shape still
need calibration before treating the displayed percent as remaining volume.
The [ESP32 Wi-Fi gateway](../docs/esp32-logger.md) also has a fuel card after
updating its firmware. The laptop dashboard retains fuel frames as raw CAN.
