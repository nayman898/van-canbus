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


if __name__ == "__main__":
    unittest.main()
