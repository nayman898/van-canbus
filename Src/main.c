#include "main.h"

#include "can_protocol.h"
#include "tx3_sensor.h"

FDCAN_HandleTypeDef hfdcan1;
ADC_HandleTypeDef hadc1;

#define ADC_AVERAGE_SAMPLE_COUNT 32U
#define ADC_CONVERSION_TIMEOUT_MS 10U

static void SystemClock_Config(void);
static void GPIO_Init(void);
static void ADC1_Init(void);
static void FDCAN1_Init(void);
static void FDCAN1_Start(void);
static bool ADC1_ReadAverage(uint16_t *adc_raw);
static bool CAN_TrySend(uint32_t identifier, const uint8_t payload[8]);
static bool Heartbeat_TrySend(uint8_t sequence);
static bool CoolantTemperature_TrySend(uint8_t sequence);

int main(void)
{
    uint8_t sequence = 0U;
    uint8_t coolant_sequence = 0U;
    uint32_t next_heartbeat_ms;
    uint32_t next_coolant_ms;

    HAL_Init();
    SystemClock_Config();
    GPIO_Init();
    ADC1_Init();
    if (HAL_ADCEx_Calibration_Start(&hadc1) != HAL_OK) {
        Error_Handler();
    }
    FDCAN1_Init();
    FDCAN1_Start();

    next_heartbeat_ms = HAL_GetTick();
    next_coolant_ms = next_heartbeat_ms;

    for (;;) {
        const uint32_t now_ms = HAL_GetTick();

        if ((int32_t)(now_ms - next_heartbeat_ms) >= 0) {
            if (Heartbeat_TrySend(sequence)) {
                sequence++;
                HAL_GPIO_TogglePin(STATUS_LED_GPIO_Port, STATUS_LED_Pin);
            }
            next_heartbeat_ms += CAN_HEARTBEAT_PERIOD_MS;
        }

        if ((int32_t)(now_ms - next_coolant_ms) >= 0) {
            if (CoolantTemperature_TrySend(coolant_sequence)) {
                coolant_sequence++;
            }
            next_coolant_ms += CAN_COOLANT_PERIOD_MS;
        }
    }
}

static void SystemClock_Config(void)
{
    RCC_OscInitTypeDef oscillator = {0};
    RCC_ClkInitTypeDef clocks = {0};

    if (HAL_PWREx_ControlVoltageScaling(PWR_REGULATOR_VOLTAGE_SCALE1) != HAL_OK) {
        Error_Handler();
    }

    oscillator.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    oscillator.HSIState = RCC_HSI_ON;
    oscillator.HSIDiv = RCC_HSI_DIV1;
    oscillator.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    oscillator.PLL.PLLState = RCC_PLL_ON;
    oscillator.PLL.PLLSource = RCC_PLLSOURCE_HSI;
    oscillator.PLL.PLLM = RCC_PLLM_DIV1;
    oscillator.PLL.PLLN = 8U;
    oscillator.PLL.PLLP = RCC_PLLP_DIV2;
    oscillator.PLL.PLLQ = RCC_PLLQ_DIV2;
    oscillator.PLL.PLLR = RCC_PLLR_DIV2;
    if (HAL_RCC_OscConfig(&oscillator) != HAL_OK) {
        Error_Handler();
    }

    clocks.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_PCLK1;
    clocks.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clocks.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clocks.APB1CLKDivider = RCC_HCLK_DIV1;
    if (HAL_RCC_ClockConfig(&clocks, FLASH_LATENCY_2) != HAL_OK) {
        Error_Handler();
    }
}

static void GPIO_Init(void)
{
    GPIO_InitTypeDef gpio = {0};

    __HAL_RCC_GPIOA_CLK_ENABLE();

    HAL_GPIO_WritePin(STATUS_LED_GPIO_Port, STATUS_LED_Pin, GPIO_PIN_RESET);
    gpio.Pin = STATUS_LED_Pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(STATUS_LED_GPIO_Port, &gpio);
}

static void ADC1_Init(void)
{
    ADC_ChannelConfTypeDef channel = {0};

    hadc1.Instance = ADC1;
    hadc1.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV2;
    hadc1.Init.Resolution = ADC_RESOLUTION_12B;
    hadc1.Init.DataAlign = ADC_DATAALIGN_RIGHT;
    hadc1.Init.ScanConvMode = ADC_SCAN_DISABLE;
    hadc1.Init.EOCSelection = ADC_EOC_SINGLE_CONV;
    hadc1.Init.LowPowerAutoWait = DISABLE;
    hadc1.Init.LowPowerAutoPowerOff = DISABLE;
    hadc1.Init.ContinuousConvMode = DISABLE;
    hadc1.Init.NbrOfConversion = 1U;
    hadc1.Init.DiscontinuousConvMode = DISABLE;
    hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
    hadc1.Init.ExternalTrigConvEdge = ADC_EXTERNALTRIGCONVEDGE_NONE;
    hadc1.Init.DMAContinuousRequests = DISABLE;
    hadc1.Init.Overrun = ADC_OVR_DATA_OVERWRITTEN;
    hadc1.Init.SamplingTimeCommon1 = ADC_SAMPLETIME_160CYCLES_5;
    hadc1.Init.SamplingTimeCommon2 = ADC_SAMPLETIME_160CYCLES_5;
    hadc1.Init.OversamplingMode = DISABLE;
    hadc1.Init.TriggerFrequencyMode = ADC_TRIGGER_FREQ_LOW;
    if (HAL_ADC_Init(&hadc1) != HAL_OK) {
        Error_Handler();
    }

    channel.Channel = ADC_CHANNEL_0;
    channel.Rank = ADC_REGULAR_RANK_1;
    channel.SamplingTime = ADC_SAMPLINGTIME_COMMON_1;
    if (HAL_ADC_ConfigChannel(&hadc1, &channel) != HAL_OK) {
        Error_Handler();
    }
}

static void FDCAN1_Init(void)
{
    hfdcan1.Instance = FDCAN1;
    hfdcan1.Init.ClockDivider = FDCAN_CLOCK_DIV1;
    hfdcan1.Init.FrameFormat = FDCAN_FRAME_CLASSIC;
    hfdcan1.Init.Mode = FDCAN_MODE_NORMAL;
    hfdcan1.Init.AutoRetransmission = ENABLE;
    hfdcan1.Init.TransmitPause = DISABLE;
    hfdcan1.Init.ProtocolException = DISABLE;

    /* 64 MHz / 8 / (1 sync + 13 seg1 + 2 seg2) = 500 kbit/s. */
    hfdcan1.Init.NominalPrescaler = 8U;
    hfdcan1.Init.NominalSyncJumpWidth = 2U;
    hfdcan1.Init.NominalTimeSeg1 = 13U;
    hfdcan1.Init.NominalTimeSeg2 = 2U;

    /* Required by the peripheral even though CAN FD/BRS is disabled. */
    hfdcan1.Init.DataPrescaler = 8U;
    hfdcan1.Init.DataSyncJumpWidth = 1U;
    hfdcan1.Init.DataTimeSeg1 = 5U;
    hfdcan1.Init.DataTimeSeg2 = 2U;

    hfdcan1.Init.StdFiltersNbr = 0U;
    hfdcan1.Init.ExtFiltersNbr = 0U;
    hfdcan1.Init.TxFifoQueueMode = FDCAN_TX_FIFO_OPERATION;

    if (HAL_FDCAN_Init(&hfdcan1) != HAL_OK) {
        Error_Handler();
    }
}

static void FDCAN1_Start(void)
{
    if (HAL_FDCAN_ConfigGlobalFilter(&hfdcan1,
                                     FDCAN_REJECT,
                                     FDCAN_REJECT,
                                     FDCAN_REJECT_REMOTE,
                                     FDCAN_REJECT_REMOTE) != HAL_OK) {
        Error_Handler();
    }

    if (HAL_FDCAN_Start(&hfdcan1) != HAL_OK) {
        Error_Handler();
    }
}

static bool ADC1_ReadAverage(uint16_t *adc_raw)
{
    uint32_t sample_sum = 0U;

    if (adc_raw == NULL) {
        return false;
    }

    for (uint32_t sample = 0U; sample < ADC_AVERAGE_SAMPLE_COUNT; ++sample) {
        if (HAL_ADC_Start(&hadc1) != HAL_OK) {
            return false;
        }
        if (HAL_ADC_PollForConversion(&hadc1, ADC_CONVERSION_TIMEOUT_MS) != HAL_OK) {
            (void)HAL_ADC_Stop(&hadc1);
            return false;
        }

        sample_sum += HAL_ADC_GetValue(&hadc1);
        if (HAL_ADC_Stop(&hadc1) != HAL_OK) {
            return false;
        }
    }

    *adc_raw = (uint16_t)((sample_sum + (ADC_AVERAGE_SAMPLE_COUNT / 2U)) /
                          ADC_AVERAGE_SAMPLE_COUNT);
    return true;
}

static bool CAN_TrySend(uint32_t identifier, const uint8_t payload[8])
{
    FDCAN_TxHeaderTypeDef header = {0};

    if (HAL_FDCAN_GetTxFifoFreeLevel(&hfdcan1) == 0U) {
        return false;
    }

    header.Identifier = identifier;
    header.IdType = FDCAN_STANDARD_ID;
    header.TxFrameType = FDCAN_DATA_FRAME;
    header.DataLength = FDCAN_DLC_BYTES_8;
    header.ErrorStateIndicator = FDCAN_ESI_ACTIVE;
    header.BitRateSwitch = FDCAN_BRS_OFF;
    header.FDFormat = FDCAN_CLASSIC_CAN;
    header.TxEventFifoControl = FDCAN_NO_TX_EVENTS;
    header.MessageMarker = 0U;

    return HAL_FDCAN_AddMessageToTxFifoQ(&hfdcan1, &header, payload) == HAL_OK;
}

static bool Heartbeat_TrySend(uint8_t sequence)
{
    uint8_t payload[8];

    CanProtocol_EncodeHeartbeat(payload, sequence, HAL_GetTick());

    return CAN_TrySend(CAN_ID_ENGINE_HEARTBEAT, payload);
}

static bool CoolantTemperature_TrySend(uint8_t sequence)
{
    uint8_t payload[8];
    uint16_t adc_raw = 0U;
    Tx3SensorReading reading;

    if (ADC1_ReadAverage(&adc_raw)) {
        reading = Tx3Sensor_ConvertAdc(adc_raw);
    } else {
        reading.adc_raw = 0U;
        reading.temperature_deci_c = TX3_INVALID_TEMPERATURE_DECI_C;
        reading.status = TX3_STATUS_ADC_ERROR;
    }

    CanProtocol_EncodeCoolantTemperature(payload,
                                         sequence,
                                         reading.status,
                                         reading.adc_raw,
                                         reading.temperature_deci_c);

    return CAN_TrySend(CAN_ID_ENGINE_COOLANT_1, payload);
}

void Error_Handler(void)
{
    __disable_irq();

    for (;;) {
        HAL_GPIO_TogglePin(STATUS_LED_GPIO_Port, STATUS_LED_Pin);
        for (volatile uint32_t delay = 0U; delay < 200000U; ++delay) {
            __NOP();
        }
    }
}
