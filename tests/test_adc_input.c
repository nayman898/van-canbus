#include <assert.h>
#include <stdio.h>
#include "adc_input.h"

int main(void)
{
    ADC_TypeDef adc = {0};

    /* Reproduce the old bug using the actual ST register helper: channel 16
     * cannot fit rank 1, and aliases channel 0 in configurable mode. */
    LL_ADC_REG_SetSequencerConfigurable(&adc, LL_ADC_REG_SEQ_CONFIGURABLE);
    LL_ADC_REG_SetSequencerRanks(&adc, LL_ADC_REG_RANK_1, LL_ADC_CHANNEL_16);
    assert((adc.CHSELR & ADC_CHSELR_SQ1) == 0U);

    LL_ADC_REG_SetSequencerConfigurable(&adc, LL_ADC_REG_SEQ_FIXED);

    const uint32_t channels[] = {
        LL_ADC_CHANNEL_0, LL_ADC_CHANNEL_1, LL_ADC_CHANNEL_16,
        LL_ADC_CHANNEL_0, LL_ADC_CHANNEL_16, LL_ADC_CHANNEL_1,
    };
    const uint32_t masks[] = {1U, 2U, 1U << 16, 1U, 1U << 16, 2U};
    for (unsigned i = 0; i < sizeof(channels) / sizeof(channels[0]); ++i) {
        adc.SMPR = 0xFFFFFFFFU;
        AdcInput_SelectChannel(&adc, channels[i]);
        assert((adc.CFGR1 & ADC_CFGR1_CHSELRMOD) == 0U);
        assert(adc.CHSELR == masks[i]);
        assert(LL_ADC_GetChannelSamplingTime(&adc, channels[i]) ==
               LL_ADC_SAMPLINGTIME_COMMON_1);
    }
    puts("ADC input regression passed: fuel IN16 and coolant IN0/IN1 stay independent.");
    return 0;
}
