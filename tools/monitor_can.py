#!/usr/bin/env python3
"""Monitor the van CAN prototype through a candleLight/gs_usb adapter."""

from __future__ import annotations

import argparse
import sys

import libusb_package
from usb.backend import libusb1

# The upstream gs_usb package asks PyUSB for its default libusb backend.
# Windows does not ship that DLL, so point PyUSB at the project dependency
# before python-can loads the gs_usb interface.
_libusb_backend = libusb_package.get_libusb1_backend()
if _libusb_backend is None:
    raise RuntimeError("The bundled libusb backend could not be loaded")
libusb1.get_backend = lambda *args, **kwargs: _libusb_backend

import can


HEARTBEAT_ID = 0x100


def decode_heartbeat(data: bytearray) -> str:
    if len(data) != 8:
        return f"invalid heartbeat length={len(data)} data={data.hex(' ')}"

    uptime_ms = int.from_bytes(data[4:8], byteorder="little", signed=False)
    return (
        f"engine heartbeat: protocol={data[0]} node={data[1]} "
        f"status=0x{data[2]:02X} sequence={data[3]} uptime={uptime_ms} ms"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bitrate", type=int, default=500_000)
    parser.add_argument("--index", type=int, default=0)
    args = parser.parse_args()

    try:
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
                if message is None:
                    continue
                if not message.is_extended_id and message.arbitration_id == HEARTBEAT_ID:
                    print(f"{message.timestamp:.6f}  {decode_heartbeat(message.data)}")
                else:
                    print(message)
    except KeyboardInterrupt:
        return 0
    except Exception as exc:  # Hardware/backend errors need a concise CLI message.
        print(f"CAN monitor failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
