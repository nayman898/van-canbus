#include "rpm_sensor.h"

void RpmSensor_Capture(volatile RpmSensor *sensor, uint16_t capture,
                       uint32_t now_ms, bool overcapture)
{
    const uint16_t period = (uint16_t)(capture - sensor->previous_capture);
    const bool restart = !sensor->have_edge ||
                         (uint32_t)(now_ms - sensor->last_edge_ms) >= RPM_TIMEOUT_MS;
    sensor->previous_capture = capture;
    sensor->last_edge_ms = now_ms;
    sensor->have_edge = true;
    sensor->period_ticks = 0U;
    if (overcapture) {
        sensor->status = RPM_STATUS_OVERCAPTURE;
    } else if (restart) {
        sensor->status = RPM_STATUS_ACQUIRING;
    } else {
        sensor->period_ticks = period;
        sensor->status = period < RPM_MIN_PERIOD_TICKS ? RPM_STATUS_RANGE : RPM_STATUS_OK;
    }
}

RpmReading RpmSensor_Read(const RpmSensor *sensor, uint32_t now_ms)
{
    RpmReading reading = {sensor->period_ticks, RPM_INVALID, sensor->status};
    if (!sensor->have_edge || (uint32_t)(now_ms - sensor->last_edge_ms) >= RPM_TIMEOUT_MS) {
        reading.status = RPM_STATUS_NO_SIGNAL;
        reading.period_ticks = 0U;
    } else if (reading.status == RPM_STATUS_OK) {
        reading.rpm = (uint16_t)((1500000UL + reading.period_ticks / 2U) /
                                 reading.period_ticks);
    }
    return reading;
}
