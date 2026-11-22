#ifndef VAN_CANBUS_RPM_INPUT_H
#define VAN_CANBUS_RPM_INPUT_H
#include "rpm_sensor.h"
void RpmInput_Init(void);
RpmReading RpmInput_Read(void);
#endif
