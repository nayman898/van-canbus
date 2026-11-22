#include "main.h"
#include "debug_serial.h"
#include "can_protocol.h"
#include <stdio.h>

static UART_HandleTypeDef uart;
static uint8_t sequence;

void DebugSerial_Init(void)
{
    GPIO_InitTypeDef gpio = {0};
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_USART2_CLK_ENABLE();
    /* PA2 -> onboard ST-Link VCP via factory SB16; no extra cable/adapter.
     * TX only: the bench diagnostics accept no commands from the host. */
    gpio.Pin = GPIO_PIN_2;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    gpio.Alternate = GPIO_AF1_USART2;
    HAL_GPIO_Init(GPIOA, &gpio);
    uart.Instance = USART2;
    uart.Init.BaudRate = 115200U;
    uart.Init.WordLength = UART_WORDLENGTH_8B;
    uart.Init.StopBits = UART_STOPBITS_1;
    uart.Init.Parity = UART_PARITY_NONE;
    uart.Init.Mode = UART_MODE_TX;
    uart.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    uart.Init.OverSampling = UART_OVERSAMPLING_16;
    uart.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
    uart.Init.ClockPrescaler = UART_PRESCALER_DIV1;
    if (HAL_UART_Init(&uart) != HAL_OK) Error_Handler();
}

void DebugSerial_SendRpm(RpmReading reading)
{
    uint8_t payload[8];
    char line[48];
    /* Independent USB sequence continues even with no CAN transceiver/ACK. */
    CanProtocol_EncodeRpm(payload, sequence++, reading.status, reading.period_ticks, reading.rpm);
    const int length = snprintf(line, sizeof(line),
        "RPM %lu %02X%02X%02X%02X%02X%02X%02X%02X\r\n", (unsigned long)HAL_GetTick(),
        (unsigned int)payload[0], (unsigned int)payload[1], (unsigned int)payload[2], (unsigned int)payload[3],
        (unsigned int)payload[4], (unsigned int)payload[5], (unsigned int)payload[6], (unsigned int)payload[7]);
    if (length > 0 && (size_t)length < sizeof(line)) {
        /* At most 33 bytes (~3 ms); capture ISR remains enabled throughout. */
        (void)HAL_UART_Transmit(&uart, (const uint8_t *)line, (uint16_t)length, 10U);
    }
}
