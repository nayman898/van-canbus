#include "tx3_sensor.h"

#include <math.h>

/*
 * Three-point Steinhart-Hart fit for the Standard TX3/GM sensor family:
 *   0 C: 9335 ohms, 20 C: 3500 ohms, 80 C: 336 ohms.
 */
#define TX3_SH_A 0.00145590007462F
#define TX3_SH_B 0.000233293390644F
#define TX3_SH_C 0.0000000948176161592F
#define KELVIN_OFFSET 273.15F

static int16_t TemperatureToDeciC(float temperature_c)
{
    float scaled;

    if (!isfinite(temperature_c) || temperature_c < -3276.7F || temperature_c > 3276.7F) {
        return TX3_INVALID_TEMPERATURE_DECI_C;
    }

    scaled = temperature_c * 10.0F;
    scaled += (scaled >= 0.0F) ? 0.5F : -0.5F;
    return (int16_t)scaled;
}

Tx3SensorReading Tx3Sensor_ConvertAdc(uint16_t adc_raw)
{
    Tx3SensorReading reading = {
        .adc_raw = adc_raw,
        .temperature_deci_c = TX3_INVALID_TEMPERATURE_DECI_C,
        .status = TX3_STATUS_OK,
    };
    float resistance_ohms;
    float log_resistance;
    float inverse_kelvin;
    float temperature_c;

    if (adc_raw >= TX3_ADC_OPEN_THRESHOLD) {
        reading.status = TX3_STATUS_OPEN_CIRCUIT;
        return reading;
    }

    if (adc_raw <= TX3_ADC_SHORT_THRESHOLD) {
        reading.status = TX3_STATUS_SHORT_CIRCUIT;
        return reading;
    }

    resistance_ohms = TX3_PULLUP_OHMS * (float)adc_raw /
                       (float)(TX3_ADC_MAX_COUNTS - adc_raw);
    log_resistance = logf(resistance_ohms);
    inverse_kelvin = TX3_SH_A + (TX3_SH_B * log_resistance) +
                     (TX3_SH_C * log_resistance * log_resistance * log_resistance);
    temperature_c = (1.0F / inverse_kelvin) - KELVIN_OFFSET;
    reading.temperature_deci_c = TemperatureToDeciC(temperature_c);

    if (reading.temperature_deci_c == TX3_INVALID_TEMPERATURE_DECI_C) {
        reading.status = TX3_STATUS_CALCULATION_ERROR;
    }

    return reading;
}
