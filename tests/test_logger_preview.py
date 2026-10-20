import importlib.util
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("logger_preview", ROOT / "tools/preview_esp32_logger.py")
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


class LoggerPreviewTests(unittest.TestCase):
    def test_fuel_payload_matches_api_snapshot(self):
        for scenario in ("live", "fault", "stale", "no-can"):
            state = preview.state(scenario)
            fuel = state["fuel"]
            self.assertEqual(fuel["seen"], scenario != "no-can")
            if scenario == "no-can":
                self.assertEqual(state["frames"], [])
                continue
            frames = [frame for frame in state["frames"] if frame["id"] == 0x120]
            self.assertTrue(frames)
            for frame in frames:
                version, sensor, status, sequence, adc, resistance = struct.unpack(
                    "<BBBBHH", bytes.fromhex(frame["data"]))
                self.assertEqual((version, sensor, status, adc, resistance),
                                 (1, 1, fuel["status"], fuel["adc"], fuel["resistance_deci_ohms"]))
                self.assertEqual(sequence, frame["sequence"] % 256)
            if scenario == "fault":
                self.assertFalse(fuel["valid"])
                self.assertIsNone(fuel["estimated_percent"])
            elif scenario == "stale":
                self.assertGreaterEqual(fuel["age_ms"], 1500)
            else:
                self.assertTrue(0 <= fuel["estimated_percent"] <= 100)
