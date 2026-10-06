# Laptop monitor and dashboard

[Project home](../README.md) · [Bench setup](../docs/bench-setup.md) · [Protocol](../docs/can-protocol.md)

The Python tools read the project's CAN messages through a BTT U2C V2.1 using
the `gs_usb` interface. Windows is the documented working host setup. The
adapter needs compatible firmware and a USB backend/driver accessible to
PyUSB; the tools do not flash the adapter or install its Windows driver.

## Install on Windows

Use Python 3.10 or newer. Run these commands from the repository root in
PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

The requirements pin `python-can[gs-usb]` and `libusb-package`. The monitor
initializes the bundled libusb backend before loading the CAN interface, so
Windows does not need to provide that DLL itself. This does not replace the
USB device driver requirement.

## Browser dashboard

```powershell
.\.venv\Scripts\python tools\can_dashboard.py
```

After the first setup, double-click `start_dashboard.bat` to run the same app.
It serves the dashboard on `http://127.0.0.1:8765` and opens the default browser.
Keep its terminal open while using it; press **Ctrl+C** there to stop the server
and release the adapter. Closing the browser tab alone does not stop the app.

The dashboard displays both pre-radiator (`0x110`) and post-radiator (`0x111`)
coolant temperatures in °F/°C, independent fault/stale status, estimated sensor voltage,
ADC count, sensor faults, heartbeat uptime/sequence, frame count, and the age
of the last received frame. The browser polls the backend every 250 ms.

| Connection label | Meaning |
| --- | --- |
| `CAN live` | Adapter connected and a frame received within the last 1.5 seconds |
| `Waiting for CAN data` | Adapter connected, but no recent frame |
| `U2C disconnected` | The backend could not open or continue reading the adapter |
| `Dashboard backend unavailable` | Browser could not fetch the local server state |

The backend retries adapter errors every two seconds. **Last readings remain
visible when traffic stops**; use the connection label and frame age to judge
freshness. The connection indicator follows overall CAN traffic, not the age
of each sensor independently.

## Terminal monitor

Stop the dashboard first, then run:

```powershell
.\.venv\Scripts\python tools\monitor_can.py
```

It prints received timestamps, decoded heartbeat/coolant messages, and other
frames in python-can's text format. Press **Ctrl+C** to stop it. Unlike the
dashboard, the terminal monitor exits on adapter errors instead of retrying.

## Options

Both tools accept:

| Option | Default | Purpose |
| --- | --- | --- |
| `--bitrate` | `500000` | CAN bus bitrate; must match the node |
| `--index` | `0` | gs_usb adapter index |

The dashboard also accepts:

| Option | Default | Purpose |
| --- | --- | --- |
| `--host` | `127.0.0.1` | HTTP bind address |
| `--port` | `8765` | HTTP port |
| `--no-browser` | Off | Run without automatically opening a browser |

Example, using another HTTP port:

```powershell
.\.venv\Scripts\python tools\can_dashboard.py --port 8766 --no-browser
```

The server is local-only by default and has no authentication. Keep that
default for the laptop bench setup.

## Live monitoring and recording

The dashboard stores only its latest readings and session counters in memory.
It does **not** save a CSV, raw CAN log, or replayable recording. The terminal
monitor likewise prints to the console without creating a file.

For a basic text transcript, PowerShell can capture the terminal output:

```powershell
.\.venv\Scripts\python -u tools\monitor_can.py | Tee-Object -FilePath can-session.txt
```

Use a new filename for each session; this command overwrites that filename.
This is decoded console output, not a structured CAN recording or a playback
format. Do not run it alongside the dashboard against the same adapter.

## Troubleshooting

| Problem | Next check |
| --- | --- |
| Missing Python module | Install requirements with the same `.venv` interpreter used to launch the tool |
| Bundled libusb backend could not be loaded | Reinstall the pinned requirements and check Python/package compatibility |
| Adapter unavailable | Check USB data cable, compatible adapter firmware/driver, index, and other running CAN apps |
| Port already in use | Open the existing dashboard, stop its terminal, or choose another HTTP port |
| Server works but no frames | Follow the wiring, termination, and bitrate checks in the bench guide |
| Need the adapter's error details | Inspect `http://127.0.0.1:8765/api/state`; the backend includes an `error` field |

The scripts currently select `gs_usb` explicitly. A Linux SocketCAN setup or
Raspberry Pi deployment would need its own documented configuration; there is
no `--interface socketcan` option in these tools today.

## Decoder tests

From the repository root:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

The tests decode fixed payloads without opening the USB adapter. They still
require the installed Python dependencies because they import the monitor.
