import importlib.util
import pathlib
import unittest


MONITOR_PATH = pathlib.Path(__file__).parents[1] / "tools" / "monitor_can.py"
SPEC = importlib.util.spec_from_file_location("monitor_can", MONITOR_PATH)
assert SPEC is not None and SPEC.loader is not None
MONITOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MONITOR)


class HeartbeatDecoderTests(unittest.TestCase):
    def test_decodes_known_payload(self) -> None:
        payload = bytearray([1, 1, 1, 42, 0x78, 0x56, 0x34, 0x12])

        decoded = MONITOR.decode_heartbeat(payload)

        self.assertIn("protocol=1", decoded)
        self.assertIn("sequence=42", decoded)
        self.assertIn("uptime=305419896 ms", decoded)

    def test_rejects_wrong_length(self) -> None:
        decoded = MONITOR.decode_heartbeat(bytearray([1, 2, 3]))

        self.assertIn("invalid heartbeat length=3", decoded)

    def test_parses_structured_heartbeat(self) -> None:
        payload = bytearray([1, 1, 1, 42, 0x78, 0x56, 0x34, 0x12])

        reading = MONITOR.parse_heartbeat(payload)

        self.assertEqual(reading["sequence"], 42)
        self.assertEqual(reading["uptime_ms"], 305419896)


class CoolantDecoderTests(unittest.TestCase):
    def test_decodes_valid_temperature(self) -> None:
        # 26.6 C, approximately 79.9 F, with ADC count 2098.
        payload = bytearray([1, 1, 0, 7, 0x32, 0x08, 0x0A, 0x01])

        decoded = MONITOR.decode_coolant_temperature(payload)

        self.assertIn("79.9 F / 26.6 C", decoded)
        self.assertIn("sequence=7", decoded)
        self.assertIn("adc=2098", decoded)

    def test_decodes_open_circuit_fault(self) -> None:
        payload = bytearray([1, 1, 1, 8, 0xFF, 0x0F, 0x00, 0x80])

        decoded = MONITOR.decode_coolant_temperature(payload)

        self.assertIn("FAULT=open circuit", decoded)
        self.assertIn("adc=4095", decoded)

    def test_rejects_wrong_length(self) -> None:
        decoded = MONITOR.decode_coolant_temperature(bytearray([1, 2, 3]))

        self.assertIn("invalid coolant length=3", decoded)

    def test_parses_structured_temperature(self) -> None:
        payload = bytearray([1, 1, 0, 7, 0x32, 0x08, 0x0A, 0x01])

        reading = MONITOR.parse_coolant_temperature(payload)

        self.assertEqual(reading["status_text"], "ok")
        self.assertEqual(reading["temperature_c"], 26.6)
        self.assertAlmostEqual(reading["temperature_f"], 79.88)

    def test_fault_has_no_temperature(self) -> None:
        payload = bytearray([1, 1, 1, 8, 0xFF, 0x0F, 0x00, 0x80])

        reading = MONITOR.parse_coolant_temperature(payload)

        self.assertEqual(reading["status_text"], "open circuit")
        self.assertIsNone(reading["temperature_c"])


if __name__ == "__main__":
    unittest.main()
