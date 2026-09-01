#ifndef STM32G0XX_HAL_CONF_H
#define STM32G0XX_HAL_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

#define HAL_MODULE_ENABLED
#define HAL_ADC_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED
#define HAL_DMA_MODULE_ENABLED
#define HAL_FDCAN_MODULE_ENABLED
#define HAL_FLASH_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_PWR_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED

#define USE_HAL_FDCAN_REGISTER_CALLBACKS 0U

#ifndef HSE_VALUE
#define HSE_VALUE 8000000UL
#endif
#ifndef HSE_STARTUP_TIMEOUT
#define HSE_STARTUP_TIMEOUT 100UL
#endif
#ifndef HSI_VALUE
#define HSI_VALUE 16000000UL
#endif
#ifndef HSI48_VALUE
#define HSI48_VALUE 48000000UL
#endif
#ifndef LSI_VALUE
#define LSI_VALUE 32000UL
#endif
#ifndef LSE_VALUE
#define LSE_VALUE 32768UL
#endif
#ifndef LSE_STARTUP_TIMEOUT
#define LSE_STARTUP_TIMEOUT 5000UL
#endif
#ifndef EXTERNAL_I2S1_CLOCK_VALUE
#define EXTERNAL_I2S1_CLOCK_VALUE 48000UL
#endif
#ifndef EXTERNAL_I2S2_CLOCK_VALUE
#define EXTERNAL_I2S2_CLOCK_VALUE 48000UL
#endif

#define VDD_VALUE 3300UL
#define TICK_INT_PRIORITY 0U
#define USE_RTOS 0U
#define PREFETCH_ENABLE 1U
#define INSTRUCTION_CACHE_ENABLE 1U

#include "stm32g0xx_hal_rcc.h"
#include "stm32g0xx_hal_dma.h"
#include "stm32g0xx_hal_adc.h"
#include "stm32g0xx_hal_gpio.h"
#include "stm32g0xx_hal_cortex.h"
#include "stm32g0xx_hal_flash.h"
#include "stm32g0xx_hal_fdcan.h"
#include "stm32g0xx_hal_pwr.h"

#ifdef USE_FULL_ASSERT
void assert_failed(uint8_t *file, uint32_t line);
#else
#define assert_param(expr) ((void)0U)
#endif

#ifdef __cplusplus
}
#endif

#endif
