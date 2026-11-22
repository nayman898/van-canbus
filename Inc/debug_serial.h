#ifndef VAN_CANBUS_DEBUG_SERIAL_H
#define VAN_CANBUS_DEBUG_SERIAL_H
#include "rpm_sensor.h"
void DebugSerial_Init(void);
void DebugSerial_SendRpm(RpmReading reading);
#endif
