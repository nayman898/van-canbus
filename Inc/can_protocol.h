#ifndef VAN_CANBUS_CAN_PROTOCOL_H
#define VAN_CANBUS_CAN_PROTOCOL_H

#include <stdint.h>

#define CAN_BUS_BITRATE 500000U
#define CAN_ID_ENGINE_HEARTBEAT 0x100U
#define CAN_ID_ENGINE_COOLANT_1 0x110U
#define CAN_ID_ENGINE_COOLANT_2 0x111U
#define CAN_HEARTBEAT_PERIOD_MS 500U
#define CAN_COOLANT_PERIOD_MS 250U

#define CAN_PROTOCOL_VERSION 1U
#define CAN_NODE_ENGINE 1U
#define CAN_STATUS_BENCH_TEST 0x01U

#define CAN_SENSOR_ID_COOLANT_OUTLET 1U
#define CAN_SENSOR_ID_COOLANT_POST_RADIATOR 2U

void CanProtocol_EncodeHeartbeat(uint8_t payload[8],
                                 uint8_t sequence,
                                 uint32_t uptime_ms);

void CanProtocol_EncodeCoolantTemperature(uint8_t payload[8],
                                          uint8_t sensor_id,
                                          uint8_t sequence,
                                          uint8_t sensor_status,
                                          uint16_t adc_raw,
                                          int16_t temperature_deci_c);

#endif
