import {
  ComputedSensorSnapshot,
  SensorChannelId,
  SensorParameterConfig,
  SteinhartCoefficients,
  SteinhartPoint,
  TemperatureUnit,
} from '../types/telemetry';

export const DEFAULT_SENSOR_CONFIGS: Record<SensorChannelId, SensorParameterConfig> = {
  coolant_pre: {
    id: 'coolant_pre',
    name: 'Engine Outlet Coolant',
    shortName: 'Pre-Radiator',
    subtitle: 'Thermostat housing · before radiator',
    canIdHex: '0x110',
    canId: 0x110,
    mcuPin: 'A0 / PA0 / ADC1_IN0',
    sensorHardware: 'Standard TX3 NTC Thermistor',
    modelType: 'tx3_ntc',
    visible: true,
    displayMin: 32,
    displayMax: 250,
    targetMin: 180,
    targetMax: 202,
    warnLow: null,
    warnHigh: 205,
    dangerLow: null,
    dangerHigh: 220,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 16,
    adcOpenThreshold: 4050,
    pullupOhms: 2470,
    shPoints: [
      { tempC: 0, resistanceOhms: 9335 },
      { tempC: 20, resistanceOhms: 3500 },
      { tempC: 80, resistanceOhms: 336 },
    ],
    overrideEnabled: false,
    overrideAdcRaw: 465,
    overrideStatusMask: 0,
  },
  coolant_post: {
    id: 'coolant_post',
    name: 'Radiator Return Coolant',
    shortName: 'Post-Radiator',
    subtitle: 'Lower hose · after radiator cooling',
    canIdHex: '0x111',
    canId: 0x111,
    mcuPin: 'A1 / PA1 / ADC1_IN1',
    sensorHardware: 'Standard TX3 NTC Thermistor',
    modelType: 'tx3_ntc',
    visible: true,
    displayMin: 32,
    displayMax: 250,
    targetMin: 145,
    targetMax: 185,
    warnLow: null,
    warnHigh: 200,
    dangerLow: null,
    dangerHigh: 215,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 16,
    adcOpenThreshold: 4050,
    pullupOhms: 2470,
    shPoints: [
      { tempC: 0, resistanceOhms: 9335 },
      { tempC: 20, resistanceOhms: 3500 },
      { tempC: 80, resistanceOhms: 336 },
    ],
    overrideEnabled: false,
    overrideAdcRaw: 622,
    overrideStatusMask: 0,
  },
  fuel_level: {
    id: 'fuel_level',
    name: 'Fuel Tank Level',
    shortName: 'Fuel Level',
    subtitle: 'Isolated FG72A sender · 10–75 Ω range',
    canIdHex: '0x120',
    canId: 0x120,
    mcuPin: 'A5 / PB12 / ADC1_IN16',
    sensorHardware: 'Ford FG72A Variable Float Sender',
    modelType: 'fg72a_resistance',
    visible: true,
    displayMin: 0,
    displayMax: 100,
    targetMin: 20,
    targetMax: 100,
    warnLow: 15,
    warnHigh: null,
    dangerLow: 5,
    dangerHigh: null,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 4,
    adcOpenThreshold: 4050,
    pullupOhms: 1000,
    emptyOhms: 75.0,
    fullOhms: 10.0,
    minValidOhms: 5.0,
    maxValidOhms: 100.0,
    dampingSeconds: 5.0,
    overrideEnabled: false,
    overrideAdcRaw: 149,
    overrideStatusMask: 0,
  },
  engine_rpm: {
    id: 'engine_rpm',
    name: 'Engine RPM (Ford 400M V8)',
    shortName: 'Engine RPM',
    subtitle: 'CoilX → Adafruit 757 (B1→A1) · 4 pulses/rev · 100 kHz (10 µs/tick)',
    canIdHex: '0x130',
    canId: 0x130,
    mcuPin: 'D5 / PB4 / TIM3_CH1 (CN9 pin 6)',
    sensorHardware: 'Autosport Labs CoilX + Adafruit 757 BSS138 Level Shifter',
    modelType: 'coilx_pulse_rpm',
    visible: true,
    isProvisional: false,
    displayMin: 0,
    displayMax: 6000,
    targetMin: 600,
    targetMax: 3200,
    warnLow: 450,
    warnHigh: 4200,
    dangerLow: 250,
    dangerHigh: 5000,
    vRef: 3.3,
    coilxSupplyVolts: 5.0,
    pulsesPerRev: 4,
    minValidHz: 2.0, // 50,000 ticks (500 ms timeout) = 2.0 Hz (30 RPM)
    maxValidHz: 666.7, // 150 ticks minimum period = 666.7 Hz (10,000 RPM ceiling)
    adcMaxCounts: 4500, // 0..450.0 Hz slider in 0.1 Hz units (1000 = 100.0 Hz = 1500 RPM)
    adcShortThreshold: 20, // < 2.0 Hz (500 ms timeout -> NO PULSES)
    adcOpenThreshold: 6667, // > 666.7 Hz (< 150 ticks -> OUT OF RANGE)
    pullupOhms: 10000, // BSS138 internal 10k pull-ups on LV/HV
    overrideEnabled: false,
    overrideAdcRaw: 1000, // 100.0 Hz bench test point = 1000 ticks (10.00 ms) = 1500 RPM
    overrideStatusMask: 0,
  },
  fuel_pressure_low: {
    id: 'fuel_pressure_low',
    name: 'Carburetor Fuel Pressure',
    shortName: 'Low Fuel PSI',
    subtitle: 'Provisional · MaxTow MT-WDV11_15 3-wire',
    canIdHex: '0x140',
    canId: 0x140,
    mcuPin: 'A3 / PB1 / ADC1_IN9',
    sensorHardware: 'MT-PS-06 3-Wire via 100k/150k MCP6004',
    modelType: 'linear_voltage_divider',
    visible: true,
    isProvisional: true,
    displayMin: 0,
    displayMax: 15,
    targetMin: 5.5,
    targetMax: 7.5,
    warnLow: 4.5,
    warnHigh: 8.5,
    dangerLow: 3.0,
    dangerHigh: 10.0,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 12,
    adcOpenThreshold: 4050,
    pullupOhms: 250000,
    dividerGain: 0.6,
    zeroOffsetVolts: 0.485,
    slopePsiPerVolt: 7.3663,
    minValidSenderVolts: 0.25,
    maxValidSenderVolts: 4.8,
    overrideEnabled: false,
    overrideAdcRaw: 1042,
    overrideStatusMask: 0,
  },
  oil_pressure: {
    id: 'oil_pressure',
    name: 'Engine Oil Pressure',
    shortName: 'Oil Pressure',
    subtitle: 'Provisional · GlowShift GS-TCD04 3-wire',
    canIdHex: '0x141',
    canId: 0x141,
    mcuPin: 'A4 / PB11 / ADC1_IN15',
    sensorHardware: 'GS-TCD04 3-Wire via 100k/150k MCP6004',
    modelType: 'linear_voltage_divider',
    visible: true,
    isProvisional: true,
    displayMin: 0,
    displayMax: 100,
    targetMin: 25,
    targetMax: 65,
    warnLow: 15,
    warnHigh: 85,
    dangerLow: 10,
    dangerHigh: 95,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 12,
    adcOpenThreshold: 4050,
    pullupOhms: 250000,
    dividerGain: 0.6,
    zeroOffsetVolts: 0.5,
    slopePsiPerVolt: 36.25,
    minValidSenderVolts: 0.25,
    maxValidSenderVolts: 4.8,
    overrideEnabled: false,
    overrideAdcRaw: 1315,
    overrideStatusMask: 0,
  },
  fuel_pressure_high: {
    id: 'fuel_pressure_high',
    name: 'High-Pressure Fuel (Reference)',
    shortName: 'High Fuel PSI',
    subtitle: 'Deferred EFI reference · GS-C711-SM 3-wire',
    canIdHex: '0x142',
    canId: 0x142,
    mcuPin: 'A2 / PA4 / ADC1_IN4 (Reallocated C2.4/9 to RPM)',
    sensorHardware: 'GS-PS-02 3-Wire via 100k/150k MCP6004',
    modelType: 'linear_voltage_divider',
    visible: false,
    isProvisional: true,
    displayMin: 0,
    displayMax: 60,
    targetMin: 27,
    targetMax: 33,
    warnLow: 22,
    warnHigh: 40,
    dangerLow: 15,
    dangerHigh: 50,
    vRef: 3.3,
    adcMaxCounts: 4095,
    adcShortThreshold: 12,
    adcOpenThreshold: 4050,
    pullupOhms: 250000,
    dividerGain: 0.6,
    zeroOffsetVolts: 0.485,
    slopePsiPerVolt: 36.8098,
    minValidSenderVolts: 0.25,
    maxValidSenderVolts: 4.8,
    overrideEnabled: false,
    overrideAdcRaw: 968,
    overrideStatusMask: 0,
  },
};

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/**
 * Solve exact 3-point Steinhart-Hart coefficients (A, B, C) from 3 (tempC, resistanceOhms) points.
 * 1/T_K = A + B*ln(R) + C*(ln(R))^3
 */
export function solveSteinhartHart(
  points: [SteinhartPoint, SteinhartPoint, SteinhartPoint]
): SteinhartCoefficients {
  const [p1, p2, p3] = points;
  const r1 = Math.max(1, p1.resistanceOhms);
  const r2 = Math.max(1, p2.resistanceOhms);
  const r3 = Math.max(1, p3.resistanceOhms);

  const l1 = Math.log(r1);
  const l2 = Math.log(r2);
  const l3 = Math.log(r3);

  const y1 = 1 / (p1.tempC + 273.15);
  const y2 = 1 / (p2.tempC + 273.15);
  const y3 = 1 / (p3.tempC + 273.15);

  const denom1 = l1 - l2;
  const denom2 = l1 - l3;
  const denom3 = l2 - l3;
  if (Math.abs(denom1) < 1e-9 || Math.abs(denom2) < 1e-9 || Math.abs(denom3) < 1e-9) {
    return {
      a: 0.00145590007462,
      b: 0.000233293390644,
      c: 0.0000000948176161592,
    };
  }

  const gamma2 = (y2 - y1) / (l2 - l1);
  const gamma3 = (y3 - y1) / (l3 - l1);

  const c =
    ((gamma3 - gamma2) / (l3 - l2)) * Math.pow(l1 + l2 + l3, -1);
  const b = gamma2 - c * (l1 * l1 + l1 * l2 + l2 * l2);
  const a = y1 - (b + l1 * l1 * c) * l1;

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    return {
      a: 0.00145590007462,
      b: 0.000233293390644,
      c: 0.0000000948176161592,
    };
  }
  return { a, b, c };
}

export function tempCToResistance(
  targetTempC: number,
  coeffs: SteinhartCoefficients
): number {
  let low = 10;
  let high = 100000;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (low + high);
    const lnR = Math.log(mid);
    const invK = coeffs.a + coeffs.b * lnR + coeffs.c * lnR * lnR * lnR;
    const tempC = 1 / invK - 273.15;
    if (tempC > targetTempC) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return 0.5 * (low + high);
}

/**
 * Convert a desired engineering value back into the corresponding raw count (12-bit ADC or 0.1 Hz deci-Hz)
 * using the active channel configuration.
 */
export function reportedValueToAdc(
  value: number,
  config: SensorParameterConfig,
  tempUnit: TemperatureUnit
): number {
  const maxCounts = config.adcMaxCounts || 4095;

  if (config.modelType === 'coilx_pulse_rpm') {
    const ppr = Math.max(0.5, config.pulsesPerRev ?? 4);
    const hz = (Math.max(0, value) * ppr) / 60.0;
    const deciHz = Math.round(hz * 10);
    return Math.max(0, Math.min(maxCounts, deciHz));
  }

  if (config.modelType === 'tx3_ntc') {
    const tempC = tempUnit === 'F' ? fToC(value) : value;
    const coeffs = solveSteinhartHart(
      config.shPoints ?? DEFAULT_SENSOR_CONFIGS.coolant_pre.shPoints!
    );
    const rSensor = tempCToResistance(tempC, coeffs);
    const ratio = rSensor / (config.pullupOhms + rSensor);
    return Math.round(Math.max(0, Math.min(maxCounts, ratio * maxCounts)));
  }

  if (config.modelType === 'fg72a_resistance') {
    const empty = config.emptyOhms ?? 75;
    const full = config.fullOhms ?? 10;
    const clampedPct = Math.max(0, Math.min(100, value));
    const rSensor = empty - (clampedPct / 100) * (empty - full);
    const ratio = rSensor / (config.pullupOhms + rSensor);
    return Math.round(Math.max(0, Math.min(maxCounts, ratio * maxCounts)));
  }

  // linear_voltage_divider
  const zeroV = config.zeroOffsetVolts ?? 0.485;
  const slope = config.slopePsiPerVolt ?? 7.3663;
  const gain = config.dividerGain ?? 0.6;
  const vSender = zeroV + value / Math.max(0.001, slope);
  const vAdc = vSender * gain;
  const ratio = vAdc / Math.max(0.1, config.vRef);
  return Math.round(Math.max(0, Math.min(maxCounts, ratio * maxCounts)));
}

function buildCanPayloadHex(
  sensorIndex: number,
  statusMask: number,
  sequence: number,
  word2Unsigned: number,
  word3SignedOrUnsigned: number,
  isSignedWord3: boolean
): string {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint8(0, 1); // Protocol version 1
  view.setUint8(1, sensorIndex);
  view.setUint8(2, statusMask & 0xff);
  view.setUint8(3, sequence & 0xff);
  view.setUint16(4, Math.max(0, Math.min(65535, Math.round(word2Unsigned))), true);
  if (isSignedWord3) {
    view.setInt16(
      6,
      Math.max(-32768, Math.min(32767, Math.round(word3SignedOrUnsigned))),
      true
    );
  } else {
    view.setUint16(
      6,
      Math.max(0, Math.min(65535, Math.round(word3SignedOrUnsigned))),
      true
    );
  }
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export function decodeStatusText(
  statusMask: number,
  modelType: SensorParameterConfig['modelType']
): string {
  if (statusMask === 0) return 'VALID';
  if (modelType === 'coilx_pulse_rpm') {
    if (statusMask === 1) return 'NO PULSES';
    if (statusMask === 2) return 'ACQUIRING';
    if (statusMask === 4) return 'OUT OF RANGE';
    if (statusMask === 8) return 'CAPTURE OVERRUN';
    return `UNKNOWN 0x${statusMask.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  const flags: string[] = [];
  if (statusMask & 0x01) flags.push('Open circuit');
  if (statusMask & 0x02) flags.push('Short circuit');
  if (statusMask & 0x04) flags.push('ADC error');
  if (statusMask & 0x08) {
    flags.push(
      modelType === 'tx3_ntc' ? 'Calculation error' : 'Out of range'
    );
  }
  return flags.length ? flags.join(' + ') : `Fault 0x${statusMask.toString(16).toUpperCase()}`;
}

/**
 * Evaluate a raw input count (12-bit ADC count or 0.1 Hz pulse frequency count for RPM)
 * against a channel's modifiable configuration.
 */
export function evaluateSensorAdc(
  adcInput: number,
  config: SensorParameterConfig,
  tempUnit: TemperatureUnit,
  options: {
    sequence?: number;
    ageMs?: number;
    seen?: boolean;
    forcedStatusMask?: number;
    skipNominalComparison?: boolean;
  } = {}
): ComputedSensorSnapshot {
  const sequence = options.sequence ?? 0;
  const ageMs = options.ageMs ?? 40;
  const seen = options.seen ?? true;
  const freshTimeoutMs = config.modelType === 'coilx_pulse_rpm' ? 500 : 1500;
  const fresh = seen && ageMs < freshTimeoutMs;
  const maxCounts = Math.max(1, config.adcMaxCounts || 4095);
  const adcRaw = Math.max(0, Math.round(adcInput));
  const adcNormalizedPercent = Math.max(
    0,
    Math.min(100, (adcRaw / maxCounts) * 100)
  );

  // Special handling for CoilX + Adafruit 757 Digital Pulse RPM channel (CAN 0x130, TIM3_CH1 @ 100 kHz / 10 us ticks)
  if (config.modelType === 'coilx_pulse_rpm') {
    const pulseHz = adcRaw / 10.0; // adcRaw stores 0.1 Hz units (e.g., 1000 = 100.0 Hz = 1000 ticks)
    const minHz = config.minValidHz ?? 2.0; // 500 ms timeout = 50,000 ticks
    const maxHz = config.maxValidHz ?? 666.7; // 150 ticks min period = 10,000 RPM diagnostic ceiling
    const ppr = Math.max(0.5, config.pulsesPerRev ?? 4.0);
    const vAdc = config.vRef; // 3.30V LV translated pulse amplitude at Adafruit 757 A1 -> D5/PB4
    const vSender = config.coilxSupplyVolts ?? 5.0; // 5.00V HV conditioned pulse at CoilX B1

    // Compute 100 kHz (10 us) period ticks exactly as TIM3_CH1 captures in Src/rpm_sensor.c
    const rawPeriodTicks =
      pulseHz >= 0.1 ? Math.round(100_000.0 / pulseHz) : 0;

    let statusMask = options.forcedStatusMask ?? 0;
    if (statusMask === 0) {
      if (pulseHz < minHz || rawPeriodTicks === 0 || rawPeriodTicks >= 50000) {
        statusMask = 1; // RPM_STATUS_NO_SIGNAL (1)
      } else if (pulseHz > maxHz || rawPeriodTicks < 150) {
        statusMask = 4; // RPM_STATUS_RANGE (4)
      }
    }

    // Per docs/can-protocol.md & Src/rpm_sensor.c:
    // Range faults retain their short measured period; acquiring (2), overrun (8), and no-signal (1) use 0.
    const wirePeriodTicks =
      statusMask === 0 || statusMask === 4 ? rawPeriodTicks : 0;
    const pulsePeriodMs =
      wirePeriodTicks > 0 ? wirePeriodTicks / 100.0 : null;
    const pulsePeriodUs =
      wirePeriodTicks > 0 ? wirePeriodTicks * 10 : null;

    // Integer rounded division matching (1500000UL + period_ticks / 2U) / period_ticks for 4 PPR
    const numerator = Math.round((100_000 * 60) / ppr);
    const rpm =
      statusMask === 0 && wirePeriodTicks > 0
        ? Math.floor((numerator + Math.floor(wirePeriodTicks / 2)) / wirePeriodTicks)
        : null;
    const valid = fresh && statusMask === 0 && rpm !== null;

    let nominalReportedValue: number | null = null;
    let calibrationDelta: number | null = null;
    if (!options.skipNominalComparison) {
      const defaultCfg = DEFAULT_SENSOR_CONFIGS.engine_rpm;
      const nominalSnap = evaluateSensorAdc(adcRaw, defaultCfg, tempUnit, {
        ...options,
        skipNominalComparison: true,
      });
      nominalReportedValue = nominalSnap.reportedValue;
      if (rpm !== null && nominalReportedValue !== null) {
        calibrationDelta = rpm - nominalReportedValue;
      }
    }

    let alertState: ComputedSensorSnapshot['alertState'] = 'nominal';
    if (!fresh) {
      alertState = 'stale';
    } else if (!valid || rpm === null) {
      alertState = 'fault';
    } else if (
      (config.dangerHigh !== null && rpm >= config.dangerHigh) ||
      (config.dangerLow !== null && rpm <= config.dangerLow)
    ) {
      alertState = 'danger';
    } else if (
      (config.warnHigh !== null && rpm >= config.warnHigh) ||
      (config.warnLow !== null && rpm <= config.warnLow)
    ) {
      alertState = 'warning';
    }

    const span = Math.max(1, config.displayMax - config.displayMin);
    const gaugePercent =
      rpm === null
        ? 0
        : Math.max(0, Math.min(100, ((rpm - config.displayMin) / span) * 100));

    // Bytes 4..5 = period_ticks in 10 us units (unsigned LE), Bytes 6..7 = whole RPM (unsigned LE, 65535 if invalid)
    const canPayloadHex = buildCanPayloadHex(
      1, // CAN_NODE_ENGINE = 1
      statusMask,
      sequence,
      wirePeriodTicks,
      valid && rpm !== null ? rpm : 65535,
      false
    );

    return {
      id: config.id,
      timestampMs: Date.now(),
      ageMs,
      sequence,
      seen,
      fresh,
      valid,
      statusMask,
      statusText: decodeStatusText(statusMask, config.modelType),
      alertState,
      adcRaw,
      adcNormalizedPercent,
      vAdc,
      vSender,
      resistanceOhms: null,
      pulseHz,
      pulsePeriodMs,
      pulsePeriodUs,
      reportedValue: rpm,
      reportedUnit: 'RPM',
      reportedSecondaryValue: pulseHz,
      reportedSecondaryUnit: 'Hz',
      nominalReportedValue,
      calibrationDelta,
      gaugePercent,
      canPayloadHex,
    };
  }

  const vAdc = (adcRaw * config.vRef) / maxCounts;

  let statusMask = options.forcedStatusMask ?? 0;
  if (statusMask === 0) {
    if (adcRaw > maxCounts) {
      statusMask |= 0x04;
    } else if (adcRaw >= config.adcOpenThreshold) {
      statusMask |= 0x01;
    } else if (adcRaw <= config.adcShortThreshold) {
      statusMask |= 0x02;
    }
  }

  let vSender = vAdc;
  let resistanceOhms: number | null = null;
  let reportedValue: number | null = null;
  let reportedUnit = '';
  let reportedSecondaryValue: number | null = null;
  let reportedSecondaryUnit = '';
  let canWord3 = -32768;
  let isSignedWord3 = true;

  if (config.modelType === 'tx3_ntc') {
    reportedUnit = tempUnit === 'F' ? '°F' : '°C';
    reportedSecondaryUnit = tempUnit === 'F' ? '°C' : '°F';

    if (adcRaw > 0 && adcRaw < maxCounts) {
      resistanceOhms = (config.pullupOhms * adcRaw) / (maxCounts - adcRaw);
    }

    if (statusMask === 0 && resistanceOhms !== null && resistanceOhms > 0) {
      const coeffs = solveSteinhartHart(
        config.shPoints ?? DEFAULT_SENSOR_CONFIGS.coolant_pre.shPoints!
      );
      const lnR = Math.log(resistanceOhms);
      const invK = coeffs.a + coeffs.b * lnR + coeffs.c * lnR * lnR * lnR;
      const tempC = 1 / invK - 273.15;
      if (!Number.isFinite(tempC) || tempC < -100 || tempC > 300) {
        statusMask |= 0x08;
      } else {
        const deciC = Math.round(tempC * 10);
        canWord3 = deciC;
        const roundedC = deciC / 10;
        const roundedF = cToF(roundedC);
        reportedValue = tempUnit === 'F' ? roundedF : roundedC;
        reportedSecondaryValue = tempUnit === 'F' ? roundedC : roundedF;
      }
    }
  } else if (config.modelType === 'fg72a_resistance') {
    reportedUnit = '%';
    reportedSecondaryUnit = 'Ω';
    isSignedWord3 = false;
    canWord3 = 65535;

    if (adcRaw > 0 && adcRaw < maxCounts) {
      const denom = maxCounts - adcRaw;
      const resistanceDeciOhms = Math.floor(
        (config.pullupOhms * 10 * adcRaw + Math.floor(denom / 2)) / denom
      );
      resistanceOhms = resistanceDeciOhms / 10;

      const minOhms = config.minValidOhms ?? 5.0;
      const maxOhms = config.maxValidOhms ?? 100.0;
      if (
        statusMask === 0 &&
        (resistanceOhms < minOhms || resistanceOhms > maxOhms)
      ) {
        statusMask |= 0x08;
      }

      if (statusMask === 0) {
        canWord3 = resistanceDeciOhms;
        const empty = config.emptyOhms ?? 75.0;
        const full = config.fullOhms ?? 10.0;
        const span = Math.max(0.1, empty - full);
        const pct = Math.max(
          0,
          Math.min(100, ((empty - resistanceOhms) / span) * 100)
        );
        reportedValue = pct;
        reportedSecondaryValue = resistanceOhms;
      }
    }
  } else {
    // linear_voltage_divider
    reportedUnit = 'PSI';
    reportedSecondaryUnit = 'V sender';
    isSignedWord3 = true;
    const gain = Math.max(0.05, config.dividerGain ?? 0.6);
    vSender = vAdc / gain;
    resistanceOhms = null;

    const minV = config.minValidSenderVolts ?? 0.25;
    const maxV = config.maxValidSenderVolts ?? 4.8;
    if (statusMask === 0 && (vSender < minV || vSender > maxV)) {
      statusMask |= 0x08;
    }

    if (statusMask === 0) {
      const zeroV = config.zeroOffsetVolts ?? 0.485;
      const slope = config.slopePsiPerVolt ?? 7.3663;
      const psi = (vSender - zeroV) * slope;
      reportedValue = psi;
      reportedSecondaryValue = vSender;
      canWord3 = Math.round(psi * 10);
    }
  }

  const valid = fresh && statusMask === 0 && reportedValue !== null;

  let nominalReportedValue: number | null = null;
  let calibrationDelta: number | null = null;
  if (!options.skipNominalComparison) {
    const defaultCfg = DEFAULT_SENSOR_CONFIGS[config.id];
    const nominalSnap = evaluateSensorAdc(adcRaw, defaultCfg, tempUnit, {
      ...options,
      skipNominalComparison: true,
    });
    nominalReportedValue = nominalSnap.reportedValue;
    if (reportedValue !== null && nominalReportedValue !== null) {
      calibrationDelta = reportedValue - nominalReportedValue;
    }
  }

  const valueInBoundsUnit =
    reportedValue === null
      ? null
      : config.modelType === 'tx3_ntc' && tempUnit === 'C'
      ? cToF(reportedValue)
      : reportedValue;

  let alertState: ComputedSensorSnapshot['alertState'] = 'nominal';
  if (!fresh) {
    alertState = 'stale';
  } else if (!valid || valueInBoundsUnit === null) {
    alertState = 'fault';
  } else if (
    (config.dangerHigh !== null && valueInBoundsUnit >= config.dangerHigh) ||
    (config.dangerLow !== null && valueInBoundsUnit <= config.dangerLow)
  ) {
    alertState = 'danger';
  } else if (
    (config.warnHigh !== null && valueInBoundsUnit >= config.warnHigh) ||
    (config.warnLow !== null && valueInBoundsUnit <= config.warnLow)
  ) {
    alertState = 'warning';
  }

  const span = Math.max(0.001, config.displayMax - config.displayMin);
  const gaugePercent =
    valueInBoundsUnit === null
      ? 0
      : Math.max(
          0,
          Math.min(100, ((valueInBoundsUnit - config.displayMin) / span) * 100)
        );

  const sensorIdx =
    config.id === 'coolant_post'
      ? 2
      : config.id === 'oil_pressure'
      ? 2
      : config.id === 'fuel_pressure_high'
      ? 3
      : 1;

  const canPayloadHex = buildCanPayloadHex(
    sensorIdx,
    statusMask,
    sequence,
    adcRaw,
    canWord3,
    isSignedWord3
  );

  return {
    id: config.id,
    timestampMs: Date.now(),
    ageMs,
    sequence,
    seen,
    fresh,
    valid,
    statusMask,
    statusText: decodeStatusText(statusMask, config.modelType),
    alertState,
    adcRaw,
    adcNormalizedPercent,
    vAdc,
    vSender,
    resistanceOhms,
    reportedValue,
    reportedUnit,
    reportedSecondaryValue,
    reportedSecondaryUnit,
    nominalReportedValue,
    calibrationDelta,
    gaugePercent,
    canPayloadHex,
  };
}
