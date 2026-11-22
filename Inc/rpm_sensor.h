#ifndef VAN_CANBUS_RPM_SENSOR_H
#define VAN_CANBUS_RPM_SENSOR_H

#include <stdbool.h>
#include <stdint.h>

/* TIM3 runs at 100 kHz: 10 us/tick, 655.36 ms between wraps.
 * Four ignition events/revolution on the single-coil four-stroke V8. */
#define RPM_TIMEOUT_MS 500U
#define RPM_MIN_PERIOD_TICKS 150U /* 10,000 RPM ceiling, not an engine limit. */
#define RPM_INVALID UINT16_MAX
#define RPM_STATUS_OK 0U
#define RPM_STATUS_NO_SIGNAL 1U
#define RPM_STATUS_ACQUIRING 2U
#define RPM_STATUS_RANGE 4U
#define RPM_STATUS_OVERCAPTURE 8U

typedef struct {
    uint16_t previous_capture;
    uint16_t period_ticks;
    uint32_t last_edge_ms;
    bool have_edge;
    uint8_t status;
} RpmSensor;

typedef struct {
    uint16_t period_ticks;
    uint16_t rpm;
    uint8_t status;
} RpmReading;

void RpmSensor_Capture(volatile RpmSensor *sensor, uint16_t capture,
                       uint32_t now_ms, bool overcapture);
RpmReading RpmSensor_Read(const RpmSensor *sensor, uint32_t now_ms);

#endif
