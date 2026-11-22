"""Read Nucleo ST-Link VCP RPM diagnostics without requiring a CAN network."""
from __future__ import annotations

import csv
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

from monitor_can import parse_rpm


def parse_line(line: bytes):
    match = re.fullmatch(rb"RPM ([0-9]{1,10}) ([0-9A-Fa-f]{16})\r?", line.rstrip(b"\n"))
    if match is None:
        return None
    uptime = int(match[1])
    if uptime > 0xFFFFFFFF:
        return None
    payload = bytearray.fromhex(match[2].decode("ascii"))
    reading = parse_rpm(payload)
    reading["uptime_ms"] = uptime
    reading["payload"] = payload.hex().upper()
    return reading


class LineDecoder:
    def __init__(self):
        self.buffer = bytearray()
        self.dropping = False

    def feed(self, chunk: bytes):
        readings = []
        for byte in chunk:
            if byte == 10:
                if not self.dropping:
                    reading = parse_line(bytes(self.buffer))
                    if reading is not None:
                        readings.append(reading)
                self.buffer.clear()
                self.dropping = False
            elif not self.dropping:
                self.buffer.append(byte)
                if len(self.buffer) > 128:
                    self.buffer.clear()
                    self.dropping = True
        return readings


def resolve_port(requested: str) -> str:
    if requested.lower() != "auto":
        return requested
    from serial.tools import list_ports
    candidates = [port.device for port in list_ports.comports()
                  if port.vid == 0x0483 and port.pid == 0x374B]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one ST-Link VCP; found {len(candidates)}. Connect Nucleo or specify --serial COM7.")
    return candidates[0]


class SerialRpmReader(threading.Thread):
    def __init__(self, state, port: str, log_path: Path):
        super().__init__(name="rpm-serial-reader", daemon=True)
        self.state = state
        self.port = port
        self.log_path = log_path
        self.stop_event = threading.Event()

    def run(self):
        import serial
        # Exclusive creation prevents an accidentally reused name overwriting a log.
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_path.open("x", newline="", encoding="utf-8") as output:
                writer = csv.writer(output)
                writer.writerow(["host_utc", "node_uptime_ms", "sequence", "status", "rpm", "pulse_hz", "period_ticks", "payload"])
                output.flush()
                while not self.stop_event.is_set():
                    try:
                        port = resolve_port(self.port)
                        with serial.Serial(port, 115200, timeout=0.25) as connection:
                            decoder = LineDecoder()
                            self.state.set_connection(True)
                            while not self.stop_event.is_set():
                                chunk = connection.read(min(512, max(1, connection.in_waiting)))
                                for reading in decoder.feed(chunk):
                                    writer.writerow([datetime.now(timezone.utc).isoformat(), reading["uptime_ms"],
                                                     reading["sequence"], reading["status"], reading["rpm"],
                                                     reading["pulse_hz"], reading["period_ticks"], reading["payload"]])
                                    output.flush()
                                    self.state.receive_serial_rpm(reading, port)
                    except Exception as exc:
                        self.state.set_connection(False, str(exc))
                        self.stop_event.wait(2.0)
        except Exception as exc:
            self.state.set_connection(False, f"RPM log unavailable: {exc}")

    def stop(self):
        self.stop_event.set()
