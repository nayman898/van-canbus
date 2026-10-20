#ifndef ADC_INPUT_H
#define ADC_INPUT_H

#include "stm32g0xx_ll_adc.h"

/* Call with the ADC stopped and initialized with ADC_SCAN_SEQ_FIXED.
 * Configurable ranks cannot address IN16 on G0.
 * Replace the entire fixed sequence so coolant and fuel never accumulate. */
static inline void AdcInput_SelectChannel(ADC_TypeDef *adc, uint32_t channel)
{
    LL_ADC_REG_SetSequencerChannels(adc, channel);
    LL_ADC_SetChannelSamplingTime(adc, channel, LL_ADC_SAMPLINGTIME_COMMON_1);
}

#endif
