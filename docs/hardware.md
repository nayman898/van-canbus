# Engine-node hardware

[Documentation index](README.md) · [Next: bench setup](bench-setup.md)

The first node uses development boards and a small discrete sensor circuit.
There is no custom PCB or finalized enclosure design in this repository yet.

## Bench parts

| Quantity | Part | Role |
| ---: | --- | --- |
| 1 | ST NUCLEO-G0B1RE | Runs the firmware and samples the sensor |
| 1 | Adafruit CAN Pal | Connects the MCU's CAN peripheral to the CAN wires |
| 1 | BTT U2C V2.1 with candleLight/gs_usb-compatible firmware | Laptop USB-to-CAN interface |
| 2 | TX3 coolant thermistors | Pre-radiator and post-radiator inputs |
| 2 each | 2.00 kohm and 470 ohm resistors | Separate nominal 2.47 kohm pull-up for each sensor |
| 2 | 1 kohm resistors | Separate series resistor into A0 and A1 |
| 2 | 100 nF ceramic capacitors | ADC input filtering to ground, one per channel |
| 2 total | 120-ohm CAN terminators | One at each bus end; use the boards' termination facilities |
| As needed | USB data cables, hookup wire, prototyping board | Power, programming, and assembly |
| 1 | Multimeter | Continuity, resistance, and voltage checks |

The two terminators are the total for this bench bus, not two extra resistors
to add when board termination is already enabled. Detailed interconnects are in
[bench setup](bench-setup.md).

## First coolant input

The TX3 is used as a two-wire thermistor. Its resistance and the pull-up form a
voltage divider. The MCU reads the divider through a 1-kohm series resistor.

```text
Nucleo 3V3
    |
  2.00 kohm
    |
   470 ohm
    |
    +-------- 1 kohm -------- A0 / PA0 / ADC1_IN0
    |
 TX3 thermistor
    |
dedicated sensor return ----- Nucleo GND
```

This is the bench circuit. The 1-kohm resistor alone is not a complete
automotive transient-protection circuit. The vehicle sensor-input protection
is still to be designed and added.

The thermistor itself is not polarized. Keep a consistent signal/return wire
assignment, with the return carried back to the engine node rather than using
the engine block as the sensor return. The reserved 5 V supply in the future
sensor connector is for active sensors; this TX3 divider uses **3.3 V**.

The current code assumes a 2470-ohm pull-up. If the measured combination differs,
update `TX3_PULLUP_OHMS` in [tx3_sensor.h](../Inc/tx3_sensor.h). The conversion
in [tx3_sensor.c](../Src/tx3_sensor.c) uses these three fit points:

| Temperature | Resistance used by the firmware fit |
| ---: | ---: |
| 0 °C | 9335 ohms |
| 20 °C | 3500 ohms |
| 80 °C | 336 ohms |

These are the project's current calibration assumptions, not a guarantee for
every replacement sensor. Compare your sensor with an independent temperature
measurement before relying on its readings. The firmware averages 32 ADC
samples and reports both the raw count and calculated temperature.

## Second coolant input

Duplicate the first divider on **A1/PA1/ADC1_IN1** for post-radiator coolant.
Do not share its signal junction or pull-up with A0. Both sensors use the same
conversion constants and nominal pull-up value. Add the 100 nF filter from
each ADC pin to ground, after that channel's 1-kohm series resistor.
See [second-channel wiring and tests](bench-setup.md#second-coolant-channel).

## Vehicle hardware in preparation

The [harness plan](engine-node-harness.md) contains the purchased power-stage
parts and staged test procedure: series diode, surge resistor, TVS, input
capacitors, and a RECOM R-78K5.0-1.0 converter. Their selection is not a record
of completed vehicle-transient testing.

The intended external connections are:

- **C1, 6-pin:** power, ground, CAN-H, CAN-L, reserved wake, and a spare.
- **C2, 12-pin:** coolant inputs/returns, future active-sensor power/return,
  pressure signals, and spares.

Both connector sizes are now available for the build. Their exact housing part
numbers, contact selection, face orientation, and mounting details still need
to be recorded. Follow the provisional cavity tables in the harness plan; do
not infer physical cavity positions from a generic connector picture.

Both TX3 channels are implemented and bench reception is confirmed. GlowShift
pressure inputs remain planned; reserved pins do not imply working pressure
input circuits or firmware support.

## Manufacturer references

- [ST MB1360 / Nucleo-64 user manual](https://www.st.com/resource/en/user_manual/dm00452640.pdf): board power selection, connectors, and onboard ST-Link.
- [Adafruit CAN Pal pinouts](https://learn.adafruit.com/adafruit-can-pal/pinouts): transceiver pinouts and termination.

Check the documentation for your actual board revision when locating headers
or changing power jumpers.
