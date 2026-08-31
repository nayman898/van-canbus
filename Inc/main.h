#ifndef VAN_CANBUS_MAIN_H
#define VAN_CANBUS_MAIN_H

#include <stdbool.h>
#include <stdint.h>

#include "stm32g0xx_hal.h"

#define STATUS_LED_Pin GPIO_PIN_5
#define STATUS_LED_GPIO_Port GPIOA

extern FDCAN_HandleTypeDef hfdcan1;

void Error_Handler(void);

#endif
