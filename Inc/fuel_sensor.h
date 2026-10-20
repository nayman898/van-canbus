#ifndef VAN_CANBUS_FUEL_SENSOR_H
#define VAN_CANBUS_FUEL_SENSOR_H

#include <stdint.h>

/* Isolated FG72A sender: 3V3 -- 1k -- sender -- GND; 1k/100nF ADC filter.
 * Pull-up and ADC reference must use the same supply. Not a gauge-wire tap.
 */
#define FUEL_PULLUP_OHMS 1000U
#define FUEL_ADC_MAX_COUNTS 4095U
#define FUEL_ADC_OPEN_THRESHOLD 4050U
#define FUEL_ADC_SHORT_THRESHOLD 4U
#define FUEL_MIN_RESISTANCE_DECI_OHMS 50U
#define FUEL_MAX_RESISTANCE_DECI_OHMS 1000U
#define FUEL_INVALID_RESISTANCE_DECI_OHMS UINT16_MAX

#define FUEL_STATUS_OK 0x00U
#define FUEL_STATUS_OPEN_CIRCUIT 0x01U
#define FUEL_STATUS_SHORT_CIRCUIT 0x02U
#define FUEL_STATUS_ADC_ERROR 0x04U
#define FUEL_STATUS_OUT_OF_RANGE 0x08U

typedef struct {
    uint16_t adc_raw;
    uint16_t resistance_deci_ohms;
    uint8_t status;
} FuelSensorReading;

FuelSensorReading FuelSensor_ConvertAdc(uint16_t adc_raw);

#endif
