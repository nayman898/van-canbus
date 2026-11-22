import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "tools"))
from can_dashboard import DashboardState
from rpm_serial import LineDecoder, parse_line


class SerialRpmTests(unittest.TestCase):
    def test_chunked_stream_recovers_after_noise(self):
        decoder = LineDecoder()
        self.assertEqual(decoder.feed(b"boot text\nRPM 123 0101"), [])
        readings = decoder.feed(b"0007E803DC05\r\nRPM 223 010101080000FFFF\n")
        self.assertEqual(len(readings), 2)
        self.assertEqual(readings[0]["rpm"], 1500)
        self.assertEqual(readings[0]["uptime_ms"], 123)
        self.assertEqual(readings[1]["status_text"], "no signal")
        self.assertIsNone(readings[1]["rpm"])

    def test_corrupt_and_unbounded_lines(self):
        decoder = LineDecoder()
        self.assertEqual(decoder.feed(b"x" * 10000), [])
        self.assertEqual(len(decoder.buffer), 0)
        self.assertEqual(decoder.feed(b"RPM 1 01010007E803DC05\n"), [])
        self.assertEqual(len(decoder.feed(b"RPM 1 01010007E803DC05\n")), 1)
        for line in (b"RPM 4294967296 01010007E803DC05", b"RPM -1 01010007E803DC05",
                     b"RPM 1 01010007E803DC0G", b"RPM 1 0101", b"prefix RPM 1 01010007E803DC05"):
            self.assertIsNone(parse_line(line))

    def test_serial_freshness_is_independent_and_snapshot_copied(self):
        with patch("can_dashboard.time.monotonic", return_value=10) as clock:
            state = DashboardState(500000, 0, "auto")
            state.receive_serial_rpm(parse_line(b"RPM 123 01010007E803DC05"), "COM7")
            clock.return_value = 11
            state.receive(0x100, bytearray([1, 1, 1, 0, 0, 0, 0, 0]))
            snapshot = state.snapshot()
            self.assertEqual(snapshot["rpm"]["age_ms"], 1000)
            self.assertEqual(snapshot["transport"], "serial")
            self.assertEqual(snapshot["serial_port"], "COM7")
            snapshot["rpm"]["rpm"] = 9999
            self.assertEqual(state.snapshot()["rpm"]["rpm"], 1500)

    def test_can_rpm_uses_same_decoder(self):
        state = DashboardState(500000, 0)
        state.receive(0x130, bytearray.fromhex("01010007E803DC05"))
        self.assertEqual(state.snapshot()["rpm"]["rpm"], 1500)
        state.receive(0x130, bytearray([1]))
        self.assertEqual(state.snapshot()["rpm"]["rpm"], 1500)
