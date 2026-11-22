#include "rpm_sensor.h"
#include <assert.h>
#include <stdio.h>

int main(void)
{
    RpmSensor sensor = {0};
    assert(RpmSensor_Read(&sensor, 0).status == RPM_STATUS_NO_SIGNAL);
    assert(RpmSensor_Read(&sensor, 0).rpm == RPM_INVALID);
    RpmSensor_Capture(&sensor, 65000, 100, false);
    assert(RpmSensor_Read(&sensor, 100).status == RPM_STATUS_ACQUIRING);
    /* Counter wraps between edges: 100 Hz is 1,000 ticks and 1,500 RPM. */
    RpmSensor_Capture(&sensor, 464, 110, false);
    assert(RpmSensor_Read(&sensor, 110).rpm == 1500);
    assert(RpmSensor_Read(&sensor, 110).period_ticks == 1000);
    RpmSensor_Capture(&sensor, 964, 115, false);
    assert(RpmSensor_Read(&sensor, 115).rpm == 3000);
    RpmSensor_Capture(&sensor, 1214, 118, false);
    assert(RpmSensor_Read(&sensor, 118).rpm == 6000);
    assert(RpmSensor_Read(&sensor, 617).status == RPM_STATUS_OK);
    assert(RpmSensor_Read(&sensor, 618).status == RPM_STATUS_NO_SIGNAL);
    assert(RpmSensor_Read(&sensor, 618).period_ticks == 0);
    assert(RpmSensor_Read(&sensor, 618).rpm == RPM_INVALID);
    /* Multiple wraps during a stop must not appear as a valid period. */
    RpmSensor_Capture(&sensor, 1700, 10000, false);
    assert(RpmSensor_Read(&sensor, 10000).status == RPM_STATUS_ACQUIRING);
    RpmSensor_Capture(&sensor, 11700, 10100, false);
    assert(RpmSensor_Read(&sensor, 10100).rpm == 150); /* cranking */
    RpmSensor_Capture(&sensor, 11849, 10101, false);
    assert(RpmSensor_Read(&sensor, 10101).status == RPM_STATUS_RANGE);
    assert(RpmSensor_Read(&sensor, 10101).rpm == RPM_INVALID);
    RpmSensor_Capture(&sensor, 11849, 10101, false);
    assert(RpmSensor_Read(&sensor, 10101).status == RPM_STATUS_RANGE); /* zero period */
    RpmSensor_Capture(&sensor, 11999, 10103, false);
    assert(RpmSensor_Read(&sensor, 10103).rpm == 10000);
    RpmSensor_Capture(&sensor, 12999, 10113, true);
    assert(RpmSensor_Read(&sensor, 10113).status == RPM_STATUS_OVERCAPTURE);
    RpmSensor_Capture(&sensor, 13999, 10123, false);
    assert(RpmSensor_Read(&sensor, 10123).rpm == 1500);
    /* Millisecond rollover must preserve freshness and reacquisition. */
    sensor = (RpmSensor){0};
    RpmSensor_Capture(&sensor, 1000, UINT32_MAX - 4U, false);
    RpmSensor_Capture(&sensor, 2000, 5, false);
    assert(RpmSensor_Read(&sensor, 5).rpm == 1500);
    assert(RpmSensor_Read(&sensor, 505).status == RPM_STATUS_NO_SIGNAL);
    /* Long cranking period remains measurable below the 16-bit wrap. */
    RpmSensor_Capture(&sensor, 3000, 600, false);
    RpmSensor_Capture(&sensor, 43000, 1000, false);
    assert(RpmSensor_Read(&sensor, 1000).rpm == 38);
    puts("RPM capture, timeout, rollover and fault checks passed");
    return 0;
}
