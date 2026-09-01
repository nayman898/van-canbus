#ifndef VAN_CANBUS_TX3_SENSOR_H
#define VAN_CANBUS_TX3_SENSOR_H

#include <stdint.h>

/* Nominal bench hardware: 2.00 kohm + 470 ohm from 3V3 to the sensor signal. */
#define TX3_PULLUP_OHMS 2470.0F

#define TX3_ADC_MAX_COUNTS 4095U
#define TX3_ADC_OPEN_THRESHOLD 4050U
#define TX3_ADC_SHORT_THRESHOLD 16U

#define TX3_STATUS_OK 0x00U
#define TX3_STATUS_OPEN_CIRCUIT 0x01U
#define TX3_STATUS_SHORT_CIRCUIT 0x02U
#define TX3_STATUS_ADC_ERROR 0x04U
#define TX3_STATUS_CALCULATION_ERROR 0x08U

#define TX3_INVALID_TEMPERATURE_DECI_C INT16_MIN

typedef struct {
    uint16_t adc_raw;
    int16_t temperature_deci_c;
    uint8_t status;
} Tx3SensorReading;

Tx3SensorReading Tx3Sensor_ConvertAdc(uint16_t adc_raw);

#endif
