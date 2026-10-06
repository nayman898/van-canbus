#!/usr/bin/env python3
"""Serve a local browser dashboard for the van CAN prototype."""

from __future__ import annotations

import argparse
import json
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import can

from monitor_can import (
    COOLANT_1_ID,
    COOLANT_2_ID,
    HEARTBEAT_ID,
    configure_usb_backend,
    parse_coolant_temperature,
    parse_heartbeat,
)


STATIC_DIR = Path(__file__).with_name("dashboard")
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
}


class DashboardState:
    def __init__(self, bitrate: int, adapter_index: int) -> None:
        self._lock = threading.Lock()
        self._started = time.monotonic()
        self._last_frame: float | None = None
        self._received: dict[str, float] = {}
        self._state: dict[str, Any] = {
            "connected": False,
            "error": None,
            "bitrate": bitrate,
            "adapter_index": adapter_index,
            "frames_received": 0,
            "heartbeat": None,
            "coolant": None,
            "coolant_post": None,
        }

    def set_connection(self, connected: bool, error: str | None = None) -> None:
        with self._lock:
            self._state["connected"] = connected
            self._state["error"] = error

    def receive(self, arbitration_id: int, data: bytearray) -> None:
        try:
            if arbitration_id == HEARTBEAT_ID:
                key = "heartbeat"
                reading = parse_heartbeat(data)
            elif arbitration_id in (COOLANT_1_ID, COOLANT_2_ID):
                sensor_id = 1 if arbitration_id == COOLANT_1_ID else 2
                key = "coolant" if sensor_id == 1 else "coolant_post"
                reading = parse_coolant_temperature(data, sensor_id)
            else:
                key = ""
                reading = None
        except ValueError:
            return

        now = time.monotonic()
        with self._lock:
            self._state["frames_received"] += 1
            self._last_frame = now
            if key and reading is not None:
                reading["received_at_ms"] = int(time.time() * 1000)
                self._state[key] = reading
                self._received[key] = now

    def snapshot(self) -> dict[str, Any]:
        now = time.monotonic()
        with self._lock:
            result = dict(self._state)
            for key in ("heartbeat", "coolant", "coolant_post"):
                if result[key] is not None:
                    result[key] = dict(result[key])
                    result[key]["age_ms"] = int((now - self._received[key]) * 1000)
            result["server_uptime_ms"] = int((now - self._started) * 1000)
            result["last_frame_age_ms"] = (
                int((now - self._last_frame) * 1000) if self._last_frame is not None else None
            )
            return result


class CanReader(threading.Thread):
    def __init__(self, state: DashboardState, bitrate: int, adapter_index: int) -> None:
        super().__init__(name="can-reader", daemon=True)
        self.state = state
        self.bitrate = bitrate
        self.adapter_index = adapter_index
        self.stop_event = threading.Event()

    def run(self) -> None:
        while not self.stop_event.is_set():
            try:
                configure_usb_backend()
                with can.Bus(
                    interface="gs_usb",
                    channel=self.adapter_index,
                    index=self.adapter_index,
                    bitrate=self.bitrate,
                ) as bus:
                    self.state.set_connection(True)
                    while not self.stop_event.is_set():
                        message = bus.recv(timeout=0.5)
                        if (message is None or message.is_extended_id
                                or message.is_remote_frame or message.is_error_frame):
                            continue
                        self.state.receive(message.arbitration_id, message.data)
            except Exception as exc:
                self.state.set_connection(False, str(exc))
                self.stop_event.wait(2.0)

    def stop(self) -> None:
        self.stop_event.set()


def make_handler(state: DashboardState) -> type[BaseHTTPRequestHandler]:
    class DashboardHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            path = self.path.split("?", 1)[0]
            if path == "/api/state":
                payload = json.dumps(state.snapshot(), separators=(",", ":")).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            relative = "index.html" if path == "/" else path.lstrip("/")
            if relative not in {"index.html", "app.js", "style.css"}:
                self.send_error(404)
                return

            file_path = STATIC_DIR / relative
            try:
                payload = file_path.read_bytes()
            except OSError:
                self.send_error(404)
                return

            self.send_response(200)
            self.send_header("Content-Type", CONTENT_TYPES.get(file_path.suffix, "application/octet-stream"))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, format: str, *args: object) -> None:
            return

    return DashboardHandler


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bitrate", type=int, default=500_000)
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    state = DashboardState(args.bitrate, args.index)
    reader = CanReader(state, args.bitrate, args.index)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    url = f"http://{args.host}:{args.port}"

    reader.start()
    if not args.no_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()

    print(f"Van CAN dashboard: {url}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()
        reader.stop()
        reader.join(timeout=3.0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
