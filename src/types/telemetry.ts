export type SensorChannelId =
  | 'coolant_pre'
  | 'coolant_post'
  | 'fuel_level'
  | 'engine_rpm'
  | 'fuel_pressure_low'
  | 'oil_pressure'
  | 'fuel_pressure_high';

export type SensorModelType =
  | 'tx3_ntc'
  | 'fg72a_resistance'
  | 'coilx_pulse_rpm'
  | 'linear_voltage_divider';

export type PrimaryDisplaySource =
  | 'reported'
  | 'v_adc'
  | 'v_sender'
  | 'resistance'
  | 'adc_raw'
  | 'comparison';

export type TemperatureUnit = 'F' | 'C';

export type SimulationScenario =
  | 'live'
  | 'warmup'
  | 'hot_climb'
  | 'fault_injection'
  | 'stale'
  | 'manual_bench';

export interface SteinhartPoint {
  tempC: number;
  resistanceOhms: number;
}

export interface SteinhartCoefficients {
  a: number;
  b: number;
  c: number;
}

export interface SensorParameterConfig {
  id: SensorChannelId;
  name: string;
  shortName: string;
  subtitle: string;
  canIdHex: string;
  canId: number;
  mcuPin: string;
  sensorHardware: string;
  modelType: SensorModelType;
  visible: boolean;
  isProvisional?: boolean;

  // Modifiable Display & Threshold Bounds (stored in native engineering unit: °F for coolant, % for fuel, RPM for tach, PSI for pressure)
  displayMin: number;
  displayMax: number;
  targetMin: number;
  targetMax: number;
  warnLow: number | null;
  warnHigh: number | null;
  dangerLow: number | null;
  dangerHigh: number | null;

  // Modifiable Raw / Electrical ADC or Timer Capture Parameters
  vRef: number;
  adcMaxCounts: number;
  adcShortThreshold: number;
  adcOpenThreshold: number;

  // Thermistor / Resistive Pull-up Parameters
  pullupOhms: number;

  // TX3 Steinhart-Hart 3-point calibration
  shPoints?: [SteinhartPoint, SteinhartPoint, SteinhartPoint];

  // FG72A Fuel Resistance Parameters
  emptyOhms?: number;
  fullOhms?: number;
  minValidOhms?: number;
  maxValidOhms?: number;
  dampingSeconds?: number;

  // CoilX + Adafruit 757 Digital Pulse RPM Parameters
  pulsesPerRev?: number;
  coilxSupplyVolts?: number;
  minValidHz?: number;
  maxValidHz?: number;

  // GlowShift / MaxTow 3-wire Voltage Divider Parameters
  dividerGain?: number;
  zeroOffsetVolts?: number;
  slopePsiPerVolt?: number;
  minValidSenderVolts?: number;
  maxValidSenderVolts?: number;

  // Manual Raw Signal / Voltage / Frequency Override for Bench Testing
  overrideEnabled: boolean;
  overrideAdcRaw: number;
  overrideStatusMask: number;
}

export interface ComputedSensorSnapshot {
  id: SensorChannelId;
  timestampMs: number;
  ageMs: number;
  sequence: number;
  seen: boolean;
  fresh: boolean;
  valid: boolean;
  statusMask: number;
  statusText: string;
  alertState: 'nominal' | 'warning' | 'danger' | 'fault' | 'stale';

  // Underlying Raw Sources
  adcRaw: number;
  adcNormalizedPercent: number;
  vAdc: number;                  // Voltage at STM32 pin (0..Vref, or 3.3V logic pulse high for RPM)
  vSender: number;               // Voltage at sensor output before divider/shifter (5.0V CoilX B1 pulse for RPM)
  resistanceOhms: number | null; // Sensor resistance in Ohms (for TX3 and FG72A)
  pulseHz?: number | null;       // Ignition pulse frequency in Hz (for CoilX RPM)
  pulsePeriodMs?: number | null; // Ignition pulse period in ms (for CoilX RPM)
  pulsePeriodUs?: number | null; // Timer input-capture interval in us

  // Reported Engineering Values
  reportedValue: number | null;
  reportedUnit: string;
  reportedSecondaryValue: number | null;
  reportedSecondaryUnit: string;
  nominalReportedValue: number | null;
  calibrationDelta: number | null;

  // Gauge fill percentage (0..100%) based on user's modifiable displayMin / displayMax
  gaugePercent: number;

  // Encoded 8-byte Classical CAN payload hex string
  canPayloadHex: string;
}

export interface CanFrameRecord {
  sequence: number;
  timestampUs: number;
  canId: number;
  canIdHex: string;
  channelName: string;
  dlc: number;
  dataHex: string;
  decodedSummary: string;
  isFault: boolean;
}
