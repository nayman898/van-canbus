# Van CAN Android dashboard

Native, receive-only Android dashboard for the van's project-owned CAN network.
It connects directly to the BTT U2C over Android USB Host, so the first version
does not require a laptop or Raspberry Pi in the vehicle.

## Current capabilities

- Direct GS_USB/candleLight connection to the U2C at **500 kbit/s**.
- Decodes engine heartbeat `0x100` and coolant outlet `0x110`.
- Shows coolant in °F/°C, ADC count, estimated signal voltage, node uptime,
  frame rate, heartbeat sequence, and recent raw CAN frames.
- Records every received frame to CSV and exports it with Android's document
  picker.
- Responsive custom dashboard for a phone in portrait or the ESSGOO display in
  landscape.
- System-bar and camera-cutout spacing, larger phone readings and controls,
  compact sensor/node cards, and scrolling when the window is too short.
- Requires no Google services and no third-party runtime library.

The application never submits a CAN data frame. The U2C is deliberately started
in normal CAN mode—not listen-only—because it must provide the CAN ACK bit when
the Nucleo and U2C are the only two active nodes.

## Open and run it

1. In Android Studio, select **Open** and choose the `android-app` directory.
2. Allow the initial Gradle sync to finish.
3. On the Pixel, enable **Developer options → Wireless debugging**.
4. In Android Studio, choose **Pair Devices Using Wi-Fi** and pair the Pixel.
5. Select the Pixel as the run target and press **Run**.

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
   `100` and `110`.

Do not connect vehicle 12 V to any U2C USB or `V+` pin. The U2C is powered from
the Android USB host for this arrangement.

## Logging

Press **START LOG** to create a CSV in the app's private external-files folder.
Press **STOP LOG** to finish it. **EXPORT** opens Android's document picker and
copies the latest log to a location you choose. Export also safely stops an
active log first.

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
- `DashboardView.java` — phone/head-unit responsive display.
- `logging/CsvCanLogger.java` — raw-frame CSV logger.
