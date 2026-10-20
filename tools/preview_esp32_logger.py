#!/usr/bin/env python3
"""Preview the embedded ESP32 page locally with clearly labeled simulated CAN."""
import argparse
import csv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import math
from pathlib import Path
import struct
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
START = time.monotonic()


def state(scenario="live"):
    elapsed = time.monotonic() - START
    tick = int(elapsed * 10)
    uptime = int(elapsed * 1000) + 60000
    temperatures = [round(822 + 12 * math.sin(elapsed / 8)), round(695 + 8 * math.sin(elapsed / 10))]
    age = 5000 if scenario == "stale" else 40
    coolant = [dict(seen=scenario != "no-can", valid=True, status=0, adc=720 + i * 150,
                    deci_c=value, age_ms=age) for i, value in enumerate(temperatures)]
    if scenario == "fault":
        coolant[1].update(valid=False, status=1, adc=4095, deci_c=-32768)
    resistance = round(425 + 12 * math.sin(elapsed / 8))
    fuel = dict(seen=scenario != "no-can", valid=True, status=0,
                adc=round(4095 * resistance / (10000 + resistance)),
                resistance_deci_ohms=resistance, estimated_percent=(750 - resistance) / 6.5,
                sequence=tick % 256, age_ms=age)
    if scenario == "fault":
        fuel.update(valid=False, status=1, adc=4095,
                    resistance_deci_ohms=65535, estimated_percent=None)
    frames = []
    for sequence in range(1200 + tick - 255, 1201 + tick):
        channel = sequence % 4
        identifier = [0x100, 0x110, 0x111, 0x120][channel]
        if channel == 0:
            payload = struct.pack("<BBBBI", 1, 1, 1, sequence % 256, 3572000 + tick * 100)
        elif channel == 3:
            payload = struct.pack("<BBBBHH", 1, 1, fuel["status"], sequence % 256,
                                  fuel["adc"], fuel["resistance_deci_ohms"])
        else:
            payload = struct.pack("<BBBBHh", 1, channel, coolant[channel - 1]["status"],
                                  sequence % 256, coolant[channel - 1]["adc"], coolant[channel - 1]["deci_c"])
        frames.append(dict(sequence=sequence, timestamp_us=(uptime - (1200 + tick - sequence) * 100) * 1000,
                           id=identifier, extended=False, rtr=False, dlc=8, data=payload.hex().upper()))
    if scenario == "no-can":
        frames = []
    return dict(preview=True, boot=1, uptime_ms=uptime, received=1200 + tick if frames else 0,
                can_ready=True, bus_state=1, can_seen=bool(frames), last_frame_age_ms=age,
                recording=False, sd_enabled=False, sd_ready=False, storage_fault=False,
                reason="Live mode; SD recording off", ready_for_power_off=True,
                queue_drops=0, driver_missed=0, driver_overruns=0, bus_errors=0, storage_errors=0,
                buffered=len(frames), capacity=256, overwritten=944 + tick if frames else 0,
                coolant=coolant, fuel=fuel, heartbeat=dict(seen=bool(frames), valid=True, sequence=tick % 256,
                uptime_ms=3572000 + int(elapsed * 1000), age_ms=age), frames=frames)


class Handler(BaseHTTPRequestHandler):
    scenario = "live"

    def do_GET(self):
        path = urlsplit(self.path).path
        mime = "application/json"
        if path == "/":
            source = (ROOT / "esp32-logger/van_can_logger/web_page.h").read_text()
            body = source.split('R"HTML(', 1)[1].rsplit(')HTML";', 1)[0]
            mime = "text/html; charset=utf-8"
        elif path == "/api/live":
            payload = state(self.scenario)
            payload["frames"] = payload["frames"][-32:]
            body = json.dumps(payload)
        elif path == "/recent.csv":
            output = io.StringIO()
            writer = csv.writer(output, lineterminator="\n")
            writer.writerow(["timestamp_us", "sequence", "id", "extended", "rtr", "dlc", "data"])
            for frame in state(self.scenario)["frames"]:
                writer.writerow([frame["timestamp_us"], frame["sequence"], f'{frame["id"]:08X}', 0, 0, 8, frame["data"]])
            body, mime = output.getvalue(), "text/csv"
        elif path == "/api/files":
            body = "[]"
        else:
            self.send_error(404)
            return
        encoded = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        if path == "/recent.csv":
            self.send_header("Content-Disposition", 'attachment; filename="preview-recent.csv"')
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--scenario", choices=["live", "stale", "fault", "no-can"], default="live")
    args = parser.parse_args()
    Handler.scenario = args.scenario
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Simulated ESP32 preview: http://127.0.0.1:{args.port} ({args.scenario})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
