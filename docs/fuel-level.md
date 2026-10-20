# Fuel-level bench input — Spectra FG72A

[Documentation index](README.md) · [CAN protocol](can-protocol.md#fuel-level--0x120) ·
[Android dashboard](../android-app/README.md)

The Nucleo firmware samples the single fuel sender on **A5 / PB12 / ADC1_IN16**
and sends voltage-source ADC counts and resistance at 2 Hz. Android adds a fuel
card with raw voltage/resistance and a damped **uncalibrated level estimate**.
This feature is implemented for the isolated breadboard circuit below; hardware
acceptance, sender wiring repair, and tank calibration remain pending.

[Spectra's FG72A specifications](https://ecat.spectrapremium.com/en/parts/FG72A)
list **75 ohms empty and 10 ohms full**. This is a passive resistance sender;
the measuring circuit supplies a small current. Disconnect the original dash
gauge electrically before using this circuit. It is not a parallel gauge tap.

## Circuit and connections

```text
Nucleo 3V3 ---- R1 1k ----+---- R2 1k ----+---- A5 / PB12 / IN16
                        |              |
                 FG72A or test RT    C1 100nF
                        |              |
Nucleo GND -------------+--------------+
```

Use two 1%, 1/4 W 1-kohm resistors and one nonpolar 100nF ceramic capacitor
(marked `104`). The pull-up and ADC reference must use the same Nucleo 3.3V
supply: resistance conversion is ratiometric. R2 filters ADC sampling with C1;
it is not part of the resistance-conversion pull-up value. Neither an amplifier
nor a 5V sender supply is needed for this bench test. Worst-case normal
short-to-ground measuring current is 3.3mA.

| Test circuit | NUCLEO-G0B1RE |
| --- | --- |
| Positive rail | 3V3, CN6 pin 4 |
| Ground rail and dedicated sender return | GND, CN6 pin 6 or 7 |
| R2/C1 output junction | A5, CN8 pin 6, routed to PB12 |

**Confirm A5 routing to PB12**, not the alternative PB8/I2C route, before
connecting. The firmware configures only PB12 as analog; it does not change
physical solder bridges or configure PB8 as an input. See the connector and
solder-bridge sections of [ST UM2324](https://www.st.com/resource/en/user_manual/um2324-stm32-nucleo64-boards-mb1360-stmicroelectronics.pdf).
A0/A1 remain the coolant inputs. A2/A3/A4 remain allocated to the separate
pressure prototype; pressure firmware is not implemented by this change.

For the local interactive breadboard map, the same circuit uses these holes
on a standard 30-column board. All components and insulated jumpers are on top.
A–E connect within each column; F–J form a separate connected group.

| Part / connection | Holes |
| --- | --- |
| R1, 1k measuring pull-up | J5–J9 |
| R2, 1k ADC series | H9–H13 |
| C1, 100nF filter | F13–F15 |
| RT, removable 10 or 75 ohm test resistor | G9–G4 |
| W01, + rail to R1 | TP5–I5 |
| W02, sender return to GND | TN4–J4 |
| W03, filter return to GND | TN15–J15 |
| Nucleo 3V3 / GND | TP1 / TN1 |
| Meter red / black | I9 / TN2 |
| Output to Nucleo A5 | I13 |

`TP` / `TN` mean the chosen upper positive / ground rails, with hole numbers
aligned to the main columns. Check continuity across those rails, especially
TN1 to TN15. Lower rails are unused. Remove RT before attaching the sender's
signal to G9 and its dedicated return to G4; do not leave RT in parallel.

## Sharing the pressure board

Recommended next build: add this passive circuit to the same board as the
three GlowShift pressure channels, sharing its Nucleo 3V3 and ground rails.
Keep the fuel measuring junction separate from the pressure dividers and
the MCP6004's currently unused fourth amplifier. The fuel sender's 10–75 ohm
range and 1k pull-up give a low source impedance; amplification is not required
to begin reliable resistance checks. Expected input is about 0.033–0.230V,
approximately 246 ADC counts across the sender range. Repair connections
and calibrate the tank before deciding whether extra analog gain is useful.

The existing firmware assumes the unamplified circuit. A future gain stage
requires updated resistance conversion and fault thresholds; inserting a
unity-gain buffer alone does not expand the ADC range. No gain stage or
combined-board hole layout is implemented by this reservation.

With the stacked-pair C2 layout, **6 = sender signal** and **7 = dedicated
sender return**. At the board, cavity 6 goes to the R1/sender/R2 junction,
cavity 7 to ground, and the filtered output goes to A5. The six pairs fill C2;
RPM replaces deferred high-pressure fuel on 4/9. CoilX still needs a separate
regulated 5V feed; its supply route awaits enclosure/connector planning.
Use the molded cavity numbers and verify continuity; these are not confirmed
installed assignments. Keep the original dash gauge disconnected for this
measurement circuit. Vehicle wiring protection remains to be designed and
validated before permanent installation.

## First acceptance test

Use the October 17 ADC channel-selection fix or newer firmware. The initial
fuel build used the configurable ADC sequencer, which cannot select IN16;
fuel could mirror coolant A0 instead of responding to A5. The corrected build
uses the fixed sequencer with exactly one channel selected at a time, and waits
for the channel configuration to be ready before sampling. This needs a Nucleo
firmware update; changing the Android app or U2C cannot correct the input.

1. Use USB bench power. Check connections with power off. Start with a loose
   10-ohm resistor instead of the installed sender.
2. Power the Nucleo. Measure approximately 0.0327V at the sender junction.
   Android should show roughly 10 ohms, near 100% **EST.**, and CAN `0x120`.
3. Power off; substitute 75 ohms. Expect approximately 0.2302V, 75 ohms, near
   0% **EST.**. ADC quantization means the displayed resistance will differ
   slightly: ideal nearest counts 41/286 convert to 10.1/75.1 ohms.
4. Verify damping: the percent bar takes several seconds to settle after a
   quick change; raw voltage and resistance update immediately on receipt.
5. Disconnect the test resistor: expect **OPEN**, invalid level and resistance.
   A short to ground reports **SHORT**, not full. Intermediate incompatible
   resistances report **OUT OF RANGE**.
6. Stop fuel frames while preserving coolant traffic: fuel should become stale
   after 1.5 seconds without affecting coolant freshness. Disconnecting USB also
   hides the fuel level. Raw frames remain in the existing CSV logger.
7. Repair the installed sender's loose connections before calibration. For an
   isolated sender test, engine/ignition must be off, both sender wires must be
   detached from the old gauge/other feeds, and no external voltage may remain
   on the pair. Connect only with test-board power off. Use the dedicated return.

This test lacks vehicle wiring-fault and surge protection. Use it parked and
supervised; disconnect the breadboard before driving. No vehicle-ready input,
low-fuel safety alarm, or permanent sender installation is claimed.

## Conversion, damping, and limits

Firmware uses `R = 1000 * ADC / (4095 - ADC)` and transmits tenths of an ohm.
Update `FUEL_PULLUP_OHMS` in [fuel_sensor.h](../Inc/fuel_sensor.h) if a different
measured pull-up is fitted. Valid readings must fall within **5–100 ohms**;
these are diagnostic margins around the sender's nominal 10–75-ohm range,
not additional fuel calibration points. Raw counts stay available on faults.

Android estimates `100 * (75 - R) / 65`, clamped to 0–100%, then applies a
five-second exponential time constant to the displayed percentage only. The
label explicitly says **UNCALIBRATED**: the sender curve and custom tank shape
can make this estimate inaccurate. Voltage/resistance stay unsmoothed for
measurement. A fault, reconnection, or stale gap resets damping; faults hide
level immediately rather than slowly drifting toward empty.

Record known fuel quantities at several levels before treating percent as
usable fuel volume or adding gallons/range. Wire/contact resistance is included
in the two-wire measurement and matters with a 10-ohm full endpoint. Calibration
storage and multi-point tank curves are future work. The ESP32 Wi-Fi gateway also decodes fuel `0x120` and shows the same damped,
uncalibrated estimate and raw diagnostics. Its firmware must be updated too.
The laptop dashboard still shows coolant only and retains fuel as raw CAN.
