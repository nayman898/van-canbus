#include "can_protocol.h"

#include <stdint.h>
static int expect(const uint8_t actual[8], const uint8_t expected[8])
{
    for (int i = 0; i < 8; ++i) {
        if (actual[i] != expected[i]) return 1;
    }
    return 0;
}

int main(void)
{
    uint8_t payload[8];
    int failures = 0;
    /* Golden vectors also appear in docs/can-protocol.md and host tests. */
    const uint8_t heartbeat[8] = {1, 1, 1, 42, 0x78, 0x56, 0x34, 0x12};
    CanProtocol_EncodeHeartbeat(payload, 42, UINT32_C(0x12345678));
    failures += expect(payload, heartbeat);

    const uint8_t coolant[8] = {1, 1, 0, 7, 0x32, 0x08, 0x0a, 0x01};
    CanProtocol_EncodeCoolantTemperature(payload, 1, 7, 0, 2098, 266);
    failures += expect(payload, coolant);

    const uint8_t freezing[8] = {1, 1, 0, 255, 0x00, 0x08, 0x85, 0xff};
    CanProtocol_EncodeCoolantTemperature(payload, 1, 255, 0, 2048, -123);
    failures += expect(payload, freezing);

    const uint8_t fault[8] = {1, 1, 1, 0, 0xff, 0x0f, 0x00, 0x80};
    CanProtocol_EncodeCoolantTemperature(payload, 1, 0, 1, 4095, INT16_MIN);
    failures += expect(payload, fault);

    const uint8_t post[8] = {1, 2, 0, 7, 0x32, 0x08, 0x0a, 0x01};
    CanProtocol_EncodeCoolantTemperature(payload, 2, 7, 0, 2098, 266);
    failures += expect(payload, post);

    return failures ? 1 : 0;
}
