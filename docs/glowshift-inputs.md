# GlowShift pressure inputs — identification and provisional calibration

[Hardware](hardware.md) · [Harness](engine-node-harness.md)

The owner supplied **GS-C711-SM**, **MT-WDV11_15** and **GS-TCD04**.
**All three installed senders are three-wire**, confirmed by the owner. The
provided oil-gauge product image shows its three-wire sender and harness.
**-SM means smoked lens**, not a different electrical sender revision (owner
clarification). All three will remain connected to their existing gauges.
Electrical pinouts and excitation voltage still need confirmation. Owner-measured
fuel points now support provisional gauge-referenced calibrations below; the
historical oil curve remains a candidate. The provisional harness labels
the high- and low-pressure fuel channels EFI and carburetor respectively.

## Identified gauges and three-wire senders

| Channel | Owner's gauge model | Manufacturer information | Sender identification status |
| --- | --- | --- | --- |
| High-pressure fuel | GS-C711-SM | [GS-C711 family: 0–100 PSI, Black 7 Color](https://www.glowshiftdirect.com/black-7-color-100-psi-fuel-pressure-gauge/) | Three-wire confirmed by owner; GS-PS-02 is a listed compatible replacement; -SM is the smoked-lens option |
| Low-pressure fuel | MT-WDV11_15 | [MaxTow 15 PSI family](https://support.maxtow.com/en-US/15-psi-30-psi-and-100-psi-fuel-pressure-gauge-installation-instructions-858501) | [MT-PS-06 three-wire replacement](https://www.glowshiftdirect.com/replacement-maxtow-15-psi-fuel-pressure-sensor/) explicitly lists MT-WDV11_15 compatibility |
| Oil | GS-TCD04 | [10 Color Digital: current listing 0–145 PSI](https://www.glowshiftdirect.com/10-color-digital-oil-pressure-gauge/) | Three-wire confirmed by owner and supplied product image; two-post variants are excluded from this installation |

The owner's confirmation resolves the earlier two-post/three-wire ambiguity:
**design for three existing three-wire senders**. Older two-post replacement
listings are not relevant to this installation. Exact replacement part numbers
are useful references, but are not physically verified installed part numbers.
Do not use the oil gauge's 145 PSI display limit as proof of its sender transfer
curve, or assume its electrical curve matches the high-pressure fuel sender.

The reviewed manufacturer product and installation pages do **not** establish
the voltage/pressure curves, excitation voltage or sensor connector pinouts
needed to approve the shared inputs. Three wires alone do not establish a
0.5–4.5V transfer function. The 15 PSI MaxTow sender needs its own calibration;
do not substitute the earlier generic 30 PSI GlowShift sender example.

Reviewed installation guides:
[7 Color fuel](https://www.glowshift.com/instructions/7-Color-Series/GS-711.pdf),
[MaxTow fuel](https://www.maxtow.com/content/instructions/gauges/MT-DV11.pdf),
and [10 Color oil](https://glowshift.com/instructions/10-Color-Digital-Series/GS-TCD04-Oil-Pressure-Gauge.pdf).
Their 12V gauge-power wiring does not establish the sender's excitation voltage;
do not apply gauge supply voltage to a sender or logger signal pin.

## Current scope — October 19, 2026

Acquire low fuel pressure and oil pressure. High-pressure fuel is deferred;
its existing gauge is retained. C2 pair 4/9 now carries RPM, with the separate
CoilX 5V supply route pending enclosure planning. Historical three-channel
assignments and measurements below are reference material, not an instruction
to connect high-pressure fuel to the current harness.

## Owner-measured fuel calibration — provisional

The owner measured the installed fuel sender signals and reported the following
approximate values. Both senders remain connected to their existing gauges.
These measurements take priority over generic or other-model online curves.
The exact meter reference point and measurement uncertainty were not recorded.

| Channel | Reference pressure | Measured sender voltage |
| --- | ---: | ---: |
| High-pressure fuel | 0 PSI | About 0.48–0.49V |
| High-pressure fuel | 30 PSI | About 1.3V; regulator stays near this pressure |
| Low-pressure fuel | 0 PSI | About 0.48–0.49V |
| Low-pressure fuel | 6.7 PSI | 1.4V |
| Low-pressure fuel | 7.0 PSI | 1.43V |

Use **0.485V** as the provisional zero offset for each channel: the midpoint of
the reported zero interval, not an additional measured value.

- High-pressure fuel: `PSI ≈ 36.8 × (V_sender - 0.485)`.
  The underlying two-point slope is `30 / (1.3 - 0.485) = 36.8098 PSI/V`.
  Zero plus the 30 PSI point provides two calibration points despite only one
  nonzero operating pressure being available. Linearity cannot be independently
  checked with these two points.
- Low-pressure fuel: `PSI ≈ 7.37 × (V_sender - 0.485)`.
  A least-squares slope through the fixed zero and both nonzero readings gives
  `7.3663 PSI/V`. Using the unrounded fit, 1.4V gives 6.74 PSI and 1.43V gives
  6.96 PSI. These small residuals are consistent with the approximate readings;
  they are not an accuracy specification. Do not estimate the whole curve from
  the two closely spaced 6.7/7.0 PSI points alone.

These are **initial gauge-referenced fits**, not independently verified pressure
standards or confirmed factory curves. Treat them as most useful near the
measured operating pressures. Do not infer a sender's maximum pressure, complete
voltage range or supply voltage by extrapolating these points. In particular,
assuming 0.5–4.5V maps to the gauge's displayed 100/15 PSI full scale would not
match the observations. Each fuel channel needs its own calibration.

`V_sender` means voltage at the sender/gauge signal relative to its confirmed
signal return. Firmware must undo the input board's attenuation first; for the
proposed ideal 0.6 divider, `V_sender = V_ADC / 0.6`. Its actual ratio and ADC
reference still need measurement. Preserve raw voltage and out-of-range/fault
information rather than silently clamping every negative result to zero.

No need to change the regulator to collect another point now. Later, compare
the completed input board against these readings, confirm gauge readings are
unchanged by the tap, and add other naturally available steady pressures. Oil
still needs an installed-sensor voltage/pressure pair for a starting check.
These constants are documented only; pressure firmware is not yet implemented.

## Online transfer-curve research

A broader search found useful historical data beyond the installation manuals.
The earlier conclusion should be read as **no exact manufacturer-verified curve
for the installed senders found yet**, not that no GlowShift curves exist online.

### Oil: historical curve found, exact installed model not verified

In a [2012 EvolutionM integration thread](https://www.evolutionm.net/forums/ecu-flash/593555-dlp-io8-data-logging.html),
the sender owner publishes an eleven-point curve for a **GS-ET04** oil gauge
and corrects the initial wire-count description to three-wire. The listed
endpoints are 0.5V at 0 PSI and 4.5V at 145 PSI, with linear intermediate values.
This is an owner's report, not a retrieved manufacturer datasheet. The source
was readable in indexed search excerpts; direct page retrieval failed.

Derived candidate equation, with V measured at the sender signal:

`oil_PSI = (V - 0.5) × 36.25`

| Sender voltage | PSI from the candidate equation |
| --- | ---: |
| 0.5V | 0 |
| 1.5V | 36.25 |
| 2.5V | 72.5 |
| 3.5V | 108.75 |
| 4.5V | 145 |

A [Miata owner describing their own installation](https://forum.miata.net/vb/showthread.php?t=729766)
also reports the same endpoints for a GlowShift oil sensor, without identifying
the exact gauge model in the indexed excerpt. The complete thread was blocked
from retrieval. This supports a **candidate to test for GS-TCD04**, not a
confirmed match: GS-ET04 and GS-TCD04 are different gauge models. Do not enable
this as a verified pressure reading or alarm threshold yet.

### Fuel: measurements found, exact curves still missing

A [2015 MSEXTRA sender-owner discussion](https://www.msextra.com/forums/viewtopic.php?t=58998)
contains firsthand fuel-pressure measurements: 0.5V at zero and 1.65V at
44.5 PSI. The author reports calibration problems, later a correction, and
continued oil-gauge disagreement. No exact sender part number or final complete
curve is established. These points do not support a universal 0.5–4.5V/full-scale
mapping and must not be copied to either installed fuel sender.

For **GS-C711-SM / GS-PS-02 candidate** and **MT-WDV11_15 / MT-PS-06 candidate**,
no exact factory transfer table was located in this search. The owner-measured
provisional fits above now provide a practical starting calibration. Search scope included
manufacturer/support pages, model/part-number searches, older manuals, owner
integration discussions and source-code searches. Generic 100 PSI sensor
curves, other brands' curves, and generated shopping articles were excluded as
calibration evidence. The manufacturer's sender pinout, excitation and exact
fuel curves remain the useful questions in the inquiry below.

## Preferred approach — small board into the existing STM32

Build the [three-channel input board](glowshift-circuit.md), with the complete
schematic, through-hole parts list and socket-pin wiring. This replaces the
earlier 5V-buffer/10k–15k-divider concept with a simpler **3.3V-powered** design:
a 100k/150k divider, input filter/clamps, MCP6004 follower and ADC output RC per
channel. Nominal gain remains 0.6, so the sender-voltage calibration formulas
above are unchanged after undoing attenuation.

The owner prefers this low-cost board if assembly is manageable. **AnalogX2 is
optional.** The new circuit uses the existing STM32 ADC: high fuel on A2/PA4/IN4,
low fuel on A3/PB1/IN9 and oil on A4/PB11/IN15 after verifying its board routing.
The dividers load each sender by 250k ohms; the buffer isolates the ADC sampling
load, not the input divider. Verify original gauge readings do not change.

This is a supervised prototype with manual input disconnection before MCU power
off; the bleeder is not an isolation switch. An unattended permanent installation
needs power sequencing/isolation and vehicle-transient behavior resolved. See
the assembly guide for the exact connection/disconnection sequence.

### Preliminary parts budget for all three channels

The [rev A shopping list](glowshift-circuit.md#shopping-list) supersedes these
early allowances: its dated October 15 parts subtotal is **$13.51**, using the
owner's existing board and including listed connectors/spares. Shipping, tax,
tariffs and tools are extra. The table below is retained as the original
general budget, not the current parts cart.

| Item | Estimated allowance |
| --- | ---: |
| One quad buffer IC | $1–3 |
| Resistors, filters and supply bypass capacitors | $2–5 |
| Input/output protection components | $3–7 |
| Small soldered board and IC socket | $4–7 |
| Connectors, wire and strain relief | $5–10 |
| **Total estimated parts** | **$15–32** |

Budget **about $20–35 before shipping/tax** to allow small purchasing differences.
Tools, assembly labor and a new enclosure are excluded. Existing enclosure
space may be usable. The remaining work is low-voltage through-hole soldering
and harness assembly, unlike the superseded custom ignition circuit. A kit or
assembled PCB can be considered if hand assembly becomes the main obstacle.

The buffer must avoid shifting the original gauge reading. Keep the sender's
supply on the existing gauge; do not join it to the engine node's 5V rail or add
a second pull-up. Confirm signal return/ground compatibility. Protect against
miswiring and vehicle transients, and prevent a powered gauge/buffer from
back-powering an unpowered MCU. A bare divider, buffer IC or ADC breakout by
itself does not complete these requirements.

### Prefab fallback

[AnalogX2](https://www.autosportlabs.com/product/analogx-4-channel-analog-to-can-bus-interface/)
remains an alternative if total build cost or assembly difficulty grows. Its
previously checked listing was $149.95 before cables, tax and shipping on
October 15, 2026. It offers buffered/protected 0–5V inputs, but still needs
sender pinout/calibration verification and receiver software support. Do not
purchase it solely to obtain the three extra ADC channels.

## Compatibility gates before connecting

1. Gauge models, three-wire senders and gauge retention are confirmed.
   Ask GlowShift/MaxTow for supply requirements,
   connector view/pinout, output type, calibration curve and permission to share
   the signal with a high-impedance logger. Do not guess pin functions by color.
2. Confirm the full normal signal range, ground offset and any pulsed excitation
   fit the selected input. Measurements can wait until the vehicle is accessible.
   If a signal exceeds 5V or uses excitation the module cannot sample
   appropriately, choose an input module suited to that signal.
3. Bench-test the analog input board independently, then compare each existing
   gauge before/after the tap over useful operating points. Verify no gauge
   shift, and include startup, gauge-off and disconnected-sender behavior.
4. Add the receiver decoder and calibration only after confirming the hardware.
   Store raw millivolts first; report pressure as unavailable until calibrated.
   For confirmed linear sensors use the documented two-point equation:
   `P = P0 + (V - V0) * (P1 - P0) / (V1 - V0)`.
   If a sender is nonlinear, use its appropriate verified table/model.

## STM32, CAN and harness work still required

The circuit assigns A2/PA4/IN4 to high fuel, A3/PB1/IN9 to low fuel and
A4/PB11/IN15 to oil (verify A4 routing). PA0/PA1 remain the two coolant inputs;
PA11/PA12 remain CAN. The STM32 ADC inputs must remain within their permitted
analog voltage range even if a pin has a digital 5V-tolerant designation.
Account for added channel scan time so existing coolant acquisition continues
at its current schedule. Firmware must reconstruct sender voltage using the
measured divider ratio and ADC reference, then apply each sender's own curve.

The current stacked-pair C2 layout assigns oil signal/return to 3/10 and
low fuel pressure to 5/8. High-pressure fuel acquisition is deferred as of
October 19; its existing gauge remains in use. Pair 4/9 is now allocated to RPM,
so do not wire the high-pressure sender tap to that pair. Its measurements and
former A2/PA4 design are retained below for a possible future addition. Confirm signal-reference
compatibility and the connector view before making the harness. ADC pin assignments are documented in the circuit, but no pressure message
format, firmware acquisition or dashboard pressure support has been implemented. Retain raw voltage and
invalid/stale status; do not display uncalibrated pressure as a real PSI value.

With direct STM32 acquisition, pressure uses new project CAN messages rather
than the AnalogX2 extended frames. If the fallback module is chosen later,
follow its [current guide](https://wiki.autosportlabs.com/AnalogX2) for 500 kbit/s,
termination and extended-frame decoding; it is not a drop-in software substitute.

## Recorded channels and remaining information

| Channel | Gauge | Gauge range | Gauge retained? | Installed sender + electrical curve |
| --- | --- | --- | --- | --- |
| Oil | GS-TCD04 | Current listing 0–145 PSI | Yes | Three-wire confirmed; historical 0.5–4.5V / 0–145 PSI candidate from related GS-ET04, not verified for this sender |
| High-pressure fuel (harness: EFI) | GS-C711-SM (smoked lens) | GS-C711 family 0–100 PSI | Yes | Three-wire confirmed; owner-measured provisional fit: 36.8 × (V − 0.485) |
| Low-pressure fuel (harness: carburetor) | MT-WDV11_15 | 0–15 PSI | Yes | Three-wire confirmed; owner-measured provisional fit: 7.37 × (V − 0.485) |

## Manufacturer inquiry — prepared, not sent

The following can be sent to GlowShift/MaxTow technical support without taking
measurements now. No message has been sent on the owner's behalf.

> I have GS-C711-SM (100 PSI fuel), MT-WDV11_15 (15 PSI fuel), and GS-TCD04
> (oil) gauges. All installed senders have three wires. -SM denotes the smoked
> lens. All will keep their original senders and gauges connected. I
> want to log their sender signals through a high-impedance buffered input
> into my STM32 ADC, provisionally designed for 0–5V sender signals.
>
> For each three-wire sender, please provide its supply/excitation voltage;
> connector pinout with connector-view
> orientation; signal type (voltage, resistance, or pulsed); full transfer
> curve/table and tolerances; and expected signal with the gauge off or sender
> disconnected. Can this logger share the signal without affecting the gauge?
>
> An owner-published GS-ET04 oil curve gives 0.5V at 0 PSI and 4.5V at
> 145 PSI. Does this also apply to my GS-TCD04 three-wire sender? Please
> confirm the exact fuel-sender curves separately. Initial measured points are:
> both fuel senders about 0.48–0.49V at zero; high fuel about 1.3V at 30 PSI;
> low fuel 1.4V at 6.7 PSI and 1.43V at 7 PSI.
