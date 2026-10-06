#!/usr/bin/env python3
"""Monitor the van CAN prototype through a candleLight/gs_usb adapter."""

from __future__ import annotations

import argparse
import sys
from typing import Any

import can


HEARTBEAT_ID = 0x100
COOLANT_1_ID = 0x110
COOLANT_2_ID = 0x111

SENSOR_STATUS = {
    0x00: "ok",
    0x01: "open circuit",
    0x02: "short circuit",
    0x04: "ADC error",
    0x08: "calculation error",
}


def configure_usb_backend() -> None:
    """Load the native USB driver only when starting a real CAN connection."""
    import libusb_package
    from usb.backend import libusb1

    # Windows does not ship libusb. Configure PyUSB before opening gs_usb, but
    # keep pure decoder imports usable in CI without native USB dependencies.
    backend = libusb_package.get_libusb1_backend()
    if backend is None:
        raise RuntimeError("The bundled libusb backend could not be loaded")
    libusb1.get_backend = lambda *args, **kwargs: backend


def parse_heartbeat(data: bytearray) -> dict[str, Any]:
    """Return structured heartbeat data for CLI and UI consumers."""
    if len(data) != 8:
        raise ValueError(f"invalid heartbeat length={len(data)}")

    return {
        "protocol": data[0],
        "node": data[1],
        "status": data[2],
        "sequence": data[3],
        "uptime_ms": int.from_bytes(data[4:8], byteorder="little", signed=False),
    }


def decode_heartbeat(data: bytearray) -> str:
    try:
        reading = parse_heartbeat(data)
    except ValueError as exc:
        return f"{exc} data={data.hex(' ')}"

    return (
        f"engine heartbeat: protocol={reading['protocol']} node={reading['node']} "
        f"status=0x{reading['status']:02X} sequence={reading['sequence']} "
        f"uptime={reading['uptime_ms']} ms"
    )


def parse_coolant_temperature(data: bytearray, sensor_id: int | None = None) -> dict[str, Any]:
    """Return structured coolant data for CLI and UI consumers."""
    if len(data) != 8:
        raise ValueError(f"invalid coolant length={len(data)}")

    status = data[2]
    adc_raw = int.from_bytes(data[4:6], byteorder="little", signed=False)
    temperature_deci_c = int.from_bytes(data[6:8], byteorder="little", signed=True)
    valid = (data[0] == 1 and data[1] in (1, 2)
             and (sensor_id is None or data[1] == sensor_id)
             and status == 0 and temperature_deci_c != -32768 and adc_raw <= 4095)
    temperature_c = temperature_deci_c / 10.0 if valid else None

    return {
        "protocol": data[0],
        "sensor": data[1],
        "status": status,
        "valid": valid,
        "status_text": SENSOR_STATUS.get(status, f"unknown 0x{status:02X}"),
        "sequence": data[3],
        "adc_raw": adc_raw,
        "voltage": adc_raw * 3.3 / 4095.0,
        "temperature_c": temperature_c,
        "temperature_f": (temperature_c * 9.0 / 5.0) + 32.0 if temperature_c is not None else None,
    }


def decode_coolant_temperature(data: bytearray, sensor_id: int | None = None) -> str:
    try:
        reading = parse_coolant_temperature(data, sensor_id)
    except ValueError as exc:
        return f"{exc} data={data.hex(' ')}"

    label = "pre-radiator" if reading["sensor"] == 1 else "post-radiator"
    if not reading["valid"]:
        return (
            f"coolant {label}: FAULT={reading['status_text'] if reading['status'] else 'invalid reading'} sequence={reading['sequence']} "
            f"adc={reading['adc_raw']} ({reading['voltage']:.3f} V)"
        )

    return (
        f"coolant {label}: {reading['temperature_f']:.1f} F / {reading['temperature_c']:.1f} C "
        f"sequence={reading['sequence']} adc={reading['adc_raw']} ({reading['voltage']:.3f} V)"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bitrate", type=int, default=500_000)
    parser.add_argument("--index", type=int, default=0)
    args = parser.parse_args()

    try:
        configure_usb_backend()
        with can.Bus(
            interface="gs_usb",
            channel=args.index,
            index=args.index,
            bitrate=args.bitrate,
        ) as bus:
            print(f"Listening on gs_usb index {args.index} at {args.bitrate} bit/s")
            print("Press Ctrl+C to stop.")
            while True:
                message = bus.recv(timeout=1.0)
                if message is None or message.is_remote_frame or message.is_error_frame:
                    continue
                if not message.is_extended_id and message.arbitration_id == HEARTBEAT_ID:
                    print(f"{message.timestamp:.6f}  {decode_heartbeat(message.data)}")
                elif not message.is_extended_id and message.arbitration_id in (COOLANT_1_ID, COOLANT_2_ID):
                    sensor_id = 1 if message.arbitration_id == COOLANT_1_ID else 2
                    print(f"{message.timestamp:.6f}  {decode_coolant_temperature(message.data, sensor_id)}")
                else:
                    print(message)
    except KeyboardInterrupt:
        return 0
    except Exception as exc:  # Hardware/backend errors need a concise CLI message.
        print(f"CAN monitor failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
