"""Independent coolant channels, including stale/fault and identity handling."""
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "tools"))
from can_dashboard import DashboardState
from monitor_can import parse_coolant_temperature


def payload(sensor=1, status=0, temperature=266):
    return bytearray([1, sensor, status, 7, 0x32, 8]) + temperature.to_bytes(2, "little", signed=True)


class DualCoolantTests(unittest.TestCase):
    def test_channels_do_not_overwrite_each_other(self):
        state = DashboardState(500000, 0)
        state.receive(0x110, payload())
        state.receive(0x111, payload(2, temperature=200))
        snapshot = state.snapshot()
        self.assertEqual(snapshot["coolant"]["temperature_c"], 26.6)
        self.assertEqual(snapshot["coolant_post"]["temperature_c"], 20.0)
        snapshot["coolant"]["temperature_c"] = -100
        self.assertEqual(state.snapshot()["coolant"]["temperature_c"], 26.6)

    def test_fresh_second_channel_does_not_refresh_first(self):
        with patch("can_dashboard.time.monotonic", return_value=10) as clock:
            state = DashboardState(500000, 0)
            state.receive(0x110, payload())
            clock.return_value = 12
            state.receive(0x111, payload(2))
            snapshot = state.snapshot()
            self.assertEqual(snapshot["coolant"]["age_ms"], 2000)
            self.assertEqual(snapshot["coolant_post"]["age_ms"], 0)

    def test_fault_on_second_leaves_first_valid(self):
        state = DashboardState(500000, 0)
        state.receive(0x110, payload())
        state.receive(0x111, payload(2, status=1, temperature=-32768))
        snapshot = state.snapshot()
        self.assertTrue(snapshot["coolant"]["valid"])
        self.assertFalse(snapshot["coolant_post"]["valid"])
        self.assertIsNone(snapshot["coolant_post"]["temperature_c"])

    def test_old_firmware_only_first_sensor(self):
        state = DashboardState(500000, 0)
        state.receive(0x110, payload())
        self.assertIsNone(state.snapshot()["coolant_post"])

    def test_invalid_payloads_never_show_temperature(self):
        wrong_version = payload(2)
        wrong_version[0] = 2
        bad_adc = payload(2)
        bad_adc[5] = 16
        for data in (payload(1), payload(2, temperature=-32768), wrong_version, bad_adc):
            reading = parse_coolant_temperature(data, sensor_id=2)
            self.assertFalse(reading["valid"])
            self.assertIsNone(reading["temperature_f"])

    def test_malformed_message_does_not_replace_reading(self):
        state = DashboardState(500000, 0)
        state.receive(0x111, payload(2))
        state.receive(0x111, bytearray([1, 2]))
        self.assertEqual(state.snapshot()["coolant_post"]["temperature_c"], 26.6)
