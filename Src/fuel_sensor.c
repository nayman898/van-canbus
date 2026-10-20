#include "fuel_sensor.h"

FuelSensorReading FuelSensor_ConvertAdc(uint16_t adc_raw)
{
    FuelSensorReading reading = {
        .adc_raw = adc_raw,
        .resistance_deci_ohms = FUEL_INVALID_RESISTANCE_DECI_OHMS,
        .status = FUEL_STATUS_OK,
    };

    if (adc_raw > FUEL_ADC_MAX_COUNTS) {
        reading.status = FUEL_STATUS_ADC_ERROR;
    } else if (adc_raw >= FUEL_ADC_OPEN_THRESHOLD) {
        reading.status = FUEL_STATUS_OPEN_CIRCUIT;
    } else if (adc_raw <= FUEL_ADC_SHORT_THRESHOLD) {
        reading.status = FUEL_STATUS_SHORT_CIRCUIT;
    } else {
        const uint32_t denominator = FUEL_ADC_MAX_COUNTS - adc_raw;
        const uint32_t resistance =
            (FUEL_PULLUP_OHMS * 10U * adc_raw + denominator / 2U) / denominator;
        if (resistance < FUEL_MIN_RESISTANCE_DECI_OHMS ||
            resistance > FUEL_MAX_RESISTANCE_DECI_OHMS) {
            reading.status = FUEL_STATUS_OUT_OF_RANGE;
        } else {
            reading.resistance_deci_ohms = (uint16_t)resistance;
        }
    }
    return reading;
}
