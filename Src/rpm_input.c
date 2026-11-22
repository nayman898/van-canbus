#include "main.h"
#include "rpm_input.h"

static volatile RpmSensor sensor;

void RpmInput_Init(void)
{
    GPIO_InitTypeDef gpio = {0};
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_TIM3_CLK_ENABLE();
    __HAL_RCC_TIM3_FORCE_RESET();
    __HAL_RCC_TIM3_RELEASE_RESET();

    /* NUCLEO-G0B1RE D5 = PB4 = AF1 TIM3_CH1. Only the translated 3.3V
     * output goes here. Pull-down gives a disconnected lead a defined state. */
    gpio.Pin = GPIO_PIN_4;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_PULLDOWN;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    gpio.Alternate = GPIO_AF1_TIM3;
    HAL_GPIO_Init(GPIOB, &gpio);

    /* SystemClock_Config uses 64 MHz APB with divide-by-one. */
    TIM3->PSC = 639U;
    TIM3->ARR = UINT16_MAX;
    /* CC1S=01: direct TI1; IC1F=0011: eight consecutive samples at fCK_INT.
     * Rising edges only; do not count both edges of the ignition pulse. */
    TIM3->CCMR1 = TIM_CCMR1_CC1S_0 | (3U << TIM_CCMR1_IC1F_Pos);
    TIM3->CCER = TIM_CCER_CC1E;
    TIM3->EGR = TIM_EGR_UG;
    TIM3->SR = 0U;
    TIM3->DIER = TIM_DIER_CC1IE;
    HAL_NVIC_SetPriority(TIM3_TIM4_IRQn, 1U, 0U);
    HAL_NVIC_EnableIRQ(TIM3_TIM4_IRQn);
    TIM3->CR1 = TIM_CR1_CEN;
}

void TIM3_TIM4_IRQHandler(void)
{
    const uint32_t flags = TIM3->SR;
    if ((flags & TIM_SR_CC1IF) != 0U) {
        const uint16_t capture = (uint16_t)TIM3->CCR1; /* Clears CC1IF. */
        const bool overcapture = ((flags | TIM3->SR) & TIM_SR_CC1OF) != 0U;
        TIM3->SR = ~TIM_SR_CC1OF;
        RpmSensor_Capture(&sensor, capture, HAL_GetTick(), overcapture);
    }
}

RpmReading RpmInput_Read(void)
{
    /* Capture ISR can update multiple fields: snapshot them atomically. */
    const uint32_t primask = __get_PRIMASK();
    __disable_irq();
    const RpmSensor snapshot = sensor;
    const uint32_t now_ms = HAL_GetTick();
    __set_PRIMASK(primask);
    return RpmSensor_Read(&snapshot, now_ms);
}
