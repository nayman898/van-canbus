# Ford 400M RPM input — CoilX selected

[Hardware](hardware.md) · [Wiring diagram](../hardware/rpm-input/schematic.svg) ·
[Parts list](../hardware/rpm-input/bom.csv) ·
[Connection list](../hardware/rpm-input/connections.csv)

Use the **Autosport Labs CoilX** for the stock single-coil distributor ignition.
This replaces the earlier custom optocoupler/monostable build. Selection is
confirmed; CoilX is still shipping as of October 19, while the owner has the
level shifter for preparation. Installation and vehicle testing
remain pending.

**Planned signal path:** coil negative → CoilX → 5V/3.3V level-shifter → STM32
→ CAN → dashboard. RPM acquisition, CAN messages and dashboard decoding still
need implementation; the current ESP32 provides a browser interface and has
no dedicated screen driver.

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
required for this planned RPM interface. Timer GPIO selection and RPM firmware
remain pending; the level converter still needs bench validation.

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
| Level converter A1 (low-voltage logic side) | Future STM32 timer-capture GPIO |

Leave unused converter channels open. A1/B1 are one matched channel, not
physical connector cavity numbers. C2 cavities 4/9 are now allocated to RPM
in place of deferred high-pressure fuel. CoilX needs a third conductor for
regulated 5V: no supply cavity is free on C2, so that feed and any added
connector await enclosure-layout planning. Keep raw coil-side wiring outside
the logic/sensor harness. STM32 timer GPIO assignment and RPM firmware remain
pending; PA0/PA1 coolant and PA11/PA12 CAN stay allocated.

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
4. Implement timer capture, missing-signal status, RPM CAN encoding and dashboard
   display after the GPIO is assigned. These features are not implemented yet.

There are four firing events per crank revolution: `RPM = pulse Hz × 15`.
CoilX's output polarity and usable capture edge should be verified during
bring-up; the old custom circuit's 1ms pulse-width assumption no longer applies.
The jumping existing tach may indicate an ignition or grounding problem that
an adapter cannot repair.
