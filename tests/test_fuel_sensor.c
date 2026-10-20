#include "fuel_sensor.h"
#include <assert.h>
#include <stdio.h>

int main(void)
{
    FuelSensorReading full = FuelSensor_ConvertAdc(41);
    assert(full.status == FUEL_STATUS_OK && full.resistance_deci_ohms == 101);
    FuelSensorReading empty = FuelSensor_ConvertAdc(286);
    assert(empty.status == FUEL_STATUS_OK && empty.resistance_deci_ohms == 751);
    FuelSensorReading half_resistance = FuelSensor_ConvertAdc(167);
    assert(half_resistance.status == FUEL_STATUS_OK && half_resistance.resistance_deci_ohms == 425);

    for (uint32_t raw = 0; raw <= UINT16_MAX; ++raw) {
        FuelSensorReading r = FuelSensor_ConvertAdc((uint16_t)raw);
        assert(r.adc_raw == raw);
        if (r.status == FUEL_STATUS_OK) {
            assert(r.resistance_deci_ohms >= 50 && r.resistance_deci_ohms <= 1000);
        } else {
            assert(r.resistance_deci_ohms == UINT16_MAX);
        }
        if (raw > 4095) assert(r.status == FUEL_STATUS_ADC_ERROR);
        else if (raw >= 4050) assert(r.status == FUEL_STATUS_OPEN_CIRCUIT);
        else if (raw <= 4) assert(r.status == FUEL_STATUS_SHORT_CIRCUIT);
    }
    assert(FuelSensor_ConvertAdc(5).status == FUEL_STATUS_OUT_OF_RANGE);
    assert(FuelSensor_ConvertAdc(4049).status == FUEL_STATUS_OUT_OF_RANGE);
    puts("Fuel conversion endpoints, all ADC values, and fault sentinels passed");
    return 0;
}
