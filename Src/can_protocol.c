#include "can_protocol.h"

void CanProtocol_EncodeHeartbeat(uint8_t payload[8],
                                 uint8_t sequence,
                                 uint32_t uptime_ms)
{
    payload[0] = CAN_PROTOCOL_VERSION;
    payload[1] = CAN_NODE_ENGINE;
    payload[2] = CAN_STATUS_BENCH_TEST;
    payload[3] = sequence;
    payload[4] = (uint8_t)(uptime_ms & 0xFFU);
    payload[5] = (uint8_t)((uptime_ms >> 8U) & 0xFFU);
    payload[6] = (uint8_t)((uptime_ms >> 16U) & 0xFFU);
    payload[7] = (uint8_t)((uptime_ms >> 24U) & 0xFFU);
}
