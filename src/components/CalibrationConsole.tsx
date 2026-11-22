import React, { useMemo, useState } from 'react';
import {
  ComputedSensorSnapshot,
  SensorChannelId,
  SensorParameterConfig,
  SteinhartPoint,
  TemperatureUnit,
} from '../types/telemetry';
import {
  cToF,
  DEFAULT_SENSOR_CONFIGS,
  evaluateSensorAdc,
  fToC,
  reportedValueToAdc,
  solveSteinhartHart,
} from '../utils/sensorMath';
import { RotateCcw, Copy, Check, Sliders, Cpu, Activity } from 'lucide-react';

interface CalibrationConsoleProps {
  configs: Record<SensorChannelId, SensorParameterConfig>;
  snapshots: Record<SensorChannelId, ComputedSensorSnapshot>;
  selectedChannelId: SensorChannelId;
  tempUnit: TemperatureUnit;
  onSelectChannel: (id: SensorChannelId) => void;
  onUpdateConfig: (
    id: SensorChannelId,
    patch: Partial<SensorParameterConfig>
  ) => void;
  onResetChannel: (id: SensorChannelId) => void;
}

type XAxisMode = 'v_adc' | 'v_sender' | 'resistance' | 'adc_raw' | 'pulse_hz' | 'pulse_ms';

export const CalibrationConsole: React.FC<CalibrationConsoleProps> = ({
  configs,
  snapshots,
  selectedChannelId,
  tempUnit,
  onSelectChannel,
  onUpdateConfig,
  onResetChannel,
}) => {
  const config = configs[selectedChannelId];
  const snapshot = snapshots[selectedChannelId];
  const defaultConfig = DEFAULT_SENSOR_CONFIGS[selectedChannelId];

  const [xAxisMode, setXAxisMode] = useState<XAxisMode>('v_adc');
  const [copiedCode, setCopiedCode] = useState(false);

  const isCoolant = config.modelType === 'tx3_ntc';
  const isRpm = config.modelType === 'coilx_pulse_rpm';
  const unitLabel = isCoolant ? `°${tempUnit}` : snapshot.reportedUnit;

  // Ensure xAxisMode is appropriate for the selected channel type
  const effectiveXAxis: XAxisMode = isRpm
    ? xAxisMode === 'pulse_ms'
      ? 'pulse_ms'
      : 'pulse_hz'
    : config.modelType === 'linear_voltage_divider' &&
      (xAxisMode === 'resistance' ||
        xAxisMode === 'pulse_hz' ||
        xAxisMode === 'pulse_ms')
    ? 'v_sender'
    : xAxisMode === 'pulse_hz' || xAxisMode === 'pulse_ms'
    ? 'v_adc'
    : xAxisMode;

  const toActiveUnit = (valInFOrNative: number | null): number | null => {
    if (valInFOrNative === null) return null;
    if (isCoolant && tempUnit === 'C') {
      return Number(fToC(valInFOrNative).toFixed(1));
    }
    return Number(valInFOrNative.toFixed(isRpm ? 0 : 1));
  };

  const fromActiveUnit = (valInActive: number): number => {
    if (isCoolant && tempUnit === 'C') {
      return Number(cToF(valInActive).toFixed(1));
    }
    return valInActive;
  };

  const dispMin = toActiveUnit(config.displayMin) ?? 0;
  const dispMax = toActiveUnit(config.displayMax) ?? 100;

  // Sample transfer curve across valid range for SVG plot
  const curveData = useMemo(() => {
    const samples: {
      adc: number;
      xVal: number;
      activeY: number | null;
      factoryY: number | null;
      vAdc: number;
      vSender: number;
      resistance: number | null;
      pulseHz: number | null;
    }[] = [];

    const startAdc = isRpm
      ? Math.max(30, Math.round((config.minValidHz ?? 3) * 10))
      : Math.max(1, config.adcShortThreshold + 1);
    const endAdc = isRpm
      ? Math.min(config.adcMaxCounts, Math.round((config.maxValidHz ?? 450) * 10))
      : Math.min(config.adcMaxCounts - 1, config.adcOpenThreshold - 1);

    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const adc = Math.round(startAdc + ((endAdc - startAdc) * i) / steps);
      const activeSnap = evaluateSensorAdc(adc, config, tempUnit, {
        skipNominalComparison: true,
      });
      const factorySnap = evaluateSensorAdc(adc, defaultConfig, tempUnit, {
        skipNominalComparison: true,
      });

      let xVal = adc;
      if (effectiveXAxis === 'pulse_hz') xVal = activeSnap.pulseHz ?? adc / 10;
      else if (effectiveXAxis === 'pulse_ms')
        xVal = activeSnap.pulsePeriodMs ?? 0;
      else if (effectiveXAxis === 'v_adc') xVal = activeSnap.vAdc;
      else if (effectiveXAxis === 'v_sender') xVal = activeSnap.vSender;
      else if (effectiveXAxis === 'resistance')
        xVal = activeSnap.resistanceOhms ?? 0;

      if (effectiveXAxis === 'pulse_ms' && xVal > 45) continue;
      if (
        effectiveXAxis === 'resistance' &&
        config.modelType === 'tx3_ntc' &&
        xVal > 12000
      ) {
        continue;
      }
      if (
        effectiveXAxis === 'resistance' &&
        config.modelType === 'fg72a_resistance' &&
        xVal > 130
      ) {
        continue;
      }

      samples.push({
        adc,
        xVal,
        activeY: activeSnap.valid ? activeSnap.reportedValue : null,
        factoryY: factorySnap.valid ? factorySnap.reportedValue : null,
        vAdc: activeSnap.vAdc,
        vSender: activeSnap.vSender,
        resistance: activeSnap.resistanceOhms,
        pulseHz: activeSnap.pulseHz ?? null,
      });
    }

    return samples.sort((a, b) => a.xVal - b.xVal);
  }, [config, defaultConfig, tempUnit, effectiveXAxis, isRpm]);

  // Reference comparison table across 8 key operating points
  const lookupRows = useMemo(() => {
    const adcs = isRpm
      ? [433, 600, 1000, 1500, 2000, 2800, 3400, 4000] // 43.3Hz (650), 60Hz (900), 100Hz (1500), 200Hz (3000), 400Hz (6000)
      : config.id === 'fuel_level'
      ? [40, 80, 120, 165, 210, 260, 310, 360]
      : config.modelType === 'tx3_ntc'
      ? [280, 420, 620, 950, 1450, 2098, 2750, 3300]
      : [380, 650, 950, 1250, 1650, 2100, 2600, 3150];

    return adcs.map((adc) => evaluateSensorAdc(adc, config, tempUnit));
  }, [config, tempUnit, isRpm]);

  // Generate C header macro snippet reflecting user's modified parameters
  const generatedCDefines = useMemo(() => {
    if (isRpm) {
      const ppr = config.pulsesPerRev ?? 4;
      const minHz = Math.max(0.5, config.minValidHz ?? 2.0);
      const maxHz = Math.max(10, config.maxValidHz ?? 666.7);
      const timeoutMs = Math.round(1000.0 / minHz);
      const minPeriodTicks = Math.round(100000.0 / maxHz);
      const numeratorTicks = Math.round((100000 * 60) / ppr);
      return [
        `/* Generated RPM calibration for ${config.name} (${config.canIdHex}) */`,
        `/* Signal path: Coil negative -> CoilX (5V) -> Adafruit 757 B1/A1 (3.3V) -> D5/PB4 (TIM3_CH1) */`,
        `#define CAN_ID_ENGINE_RPM ${config.canIdHex}U`,
        `#define CAN_RPM_PERIOD_MS 100U`,
        `#define RPM_TIMEOUT_MS ${timeoutMs}U`,
        `#define RPM_MIN_PERIOD_TICKS ${minPeriodTicks}U /* ${(
          numeratorTicks / minPeriodTicks
        ).toFixed(0)} RPM ceiling */`,
        `#define RPM_PULSES_PER_REV ${ppr.toFixed(1)}F`,
        `#define RPM_NUMERATOR_TICKS ${numeratorTicks}UL /* 100 kHz * 60 / PPR */`,
        `#define RPM_WARN_HIGH ${Math.round(config.warnHigh ?? 4200)}U`,
        `#define RPM_REDLINE_CRITICAL ${Math.round(config.dangerHigh ?? 5000)}U`,
      ].join('\n');
    }
    if (config.modelType === 'tx3_ntc') {
      const coeffs = solveSteinhartHart(
        config.shPoints ?? defaultConfig.shPoints!
      );
      return [
        `/* Generated calibration for ${config.name} (${config.canIdHex}) */`,
        `#define TX3_VREF_VOLTS ${config.vRef.toFixed(3)}F`,
        `#define TX3_PULLUP_OHMS ${config.pullupOhms.toFixed(1)}F`,
        `#define TX3_ADC_OPEN_THRESHOLD ${config.adcOpenThreshold}U`,
        `#define TX3_ADC_SHORT_THRESHOLD ${config.adcShortThreshold}U`,
        `#define TX3_SH_A ${coeffs.a.toExponential(9)}F`,
        `#define TX3_SH_B ${coeffs.b.toExponential(9)}F`,
        `#define TX3_SH_C ${coeffs.c.toExponential(9)}F`,
      ].join('\n');
    }
    if (config.modelType === 'fg72a_resistance') {
      return [
        `/* Generated calibration for ${config.name} (${config.canIdHex}) */`,
        `#define FUEL_PULLUP_OHMS ${Math.round(config.pullupOhms)}U`,
        `#define FUEL_ADC_OPEN_THRESHOLD ${config.adcOpenThreshold}U`,
        `#define FUEL_ADC_SHORT_THRESHOLD ${config.adcShortThreshold}U`,
        `#define FUEL_MIN_RESISTANCE_DECI_OHMS ${Math.round(
          (config.minValidOhms ?? 5) * 10
        )}U`,
        `#define FUEL_MAX_RESISTANCE_DECI_OHMS ${Math.round(
          (config.maxValidOhms ?? 100) * 10
        )}U`,
        `#define FUEL_EMPTY_OHMS ${(config.emptyOhms ?? 75).toFixed(1)}F`,
        `#define FUEL_FULL_OHMS ${(config.fullOhms ?? 10).toFixed(1)}F`,
      ].join('\n');
    }
    return [
      `/* Generated provisional calibration for ${config.name} (${config.canIdHex}) */`,
      `#define PRESSURE_VREF_VOLTS ${config.vRef.toFixed(3)}F`,
      `#define PRESSURE_DIVIDER_GAIN ${(config.dividerGain ?? 0.6).toFixed(4)}F`,
      `#define PRESSURE_ZERO_OFFSET_VOLTS ${(
        config.zeroOffsetVolts ?? 0.485
      ).toFixed(3)}F`,
      `#define PRESSURE_SLOPE_PSI_PER_V ${(
        config.slopePsiPerVolt ?? 7.3663
      ).toFixed(4)}F`,
    ].join('\n');
  }, [config, defaultConfig, isRpm]);

  const handleCopyDefines = () => {
    navigator.clipboard?.writeText(generatedCDefines);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const chartGeom = useMemo(() => {
    const W = 640;
    const H = 260;
    const padL = 58;
    const padR = 22;
    const padT = 18;
    const padB = 36;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xValues = curveData.map((d) => d.xVal);
    const minX = xValues.length ? Math.min(...xValues) : 0;
    const maxX = xValues.length ? Math.max(...xValues, minX + 0.01) : 1;

    const minY = dispMin;
    const maxY = Math.max(minY + 1, dispMax);

    const toSvgX = (x: number) =>
      padL + ((x - minX) / Math.max(1e-6, maxX - minX)) * plotW;
    const toSvgY = (y: number) =>
      padT +
      plotH -
      ((Math.max(minY, Math.min(maxY, y)) - minY) /
        Math.max(1e-6, maxY - minY)) *
        plotH;

    let activePath = '';
    let factoryPath = '';
    let moveA = true;
    let moveF = true;

    curveData.forEach((pt) => {
      const sx = toSvgX(pt.xVal);
      if (pt.activeY !== null) {
        const sy = toSvgY(pt.activeY);
        activePath += `${moveA ? 'M' : 'L'}${sx.toFixed(1)} ${sy.toFixed(1)} `;
        moveA = false;
      } else {
        moveA = true;
      }
      if (pt.factoryY !== null) {
        const sy = toSvgY(pt.factoryY);
        factoryPath += `${moveF ? 'M' : 'L'}${sx.toFixed(1)} ${sy.toFixed(1)} `;
        moveF = false;
      } else {
        moveF = true;
      }
    });

    let liveXVal = snapshot.adcRaw;
    if (effectiveXAxis === 'pulse_hz') liveXVal = snapshot.pulseHz ?? 0;
    else if (effectiveXAxis === 'pulse_ms')
      liveXVal = snapshot.pulsePeriodMs ?? 0;
    else if (effectiveXAxis === 'v_adc') liveXVal = snapshot.vAdc;
    else if (effectiveXAxis === 'v_sender') liveXVal = snapshot.vSender;
    else if (effectiveXAxis === 'resistance')
      liveXVal = snapshot.resistanceOhms ?? 0;

    const liveSvgX = Math.max(padL, Math.min(W - padR, toSvgX(liveXVal)));
    const liveSvgY =
      snapshot.reportedValue !== null
        ? toSvgY(snapshot.reportedValue)
        : padT + plotH / 2;

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      minX,
      maxX,
      minY,
      maxY,
      toSvgX,
      toSvgY,
      activePath,
      factoryPath,
      liveSvgX,
      liveSvgY,
      liveXVal,
    };
  }, [curveData, dispMin, dispMax, snapshot, effectiveXAxis]);

  const updateSteinhartPoint = (
    index: 0 | 1 | 2,
    patch: Partial<SteinhartPoint>
  ) => {
    const current = config.shPoints ?? defaultConfig.shPoints!;
    const next: [SteinhartPoint, SteinhartPoint, SteinhartPoint] = [
      { ...current[0] },
      { ...current[1] },
      { ...current[2] },
    ];
    next[index] = { ...next[index], ...patch };
    onUpdateConfig(config.id, { shPoints: next });
  };

  const shCoeffs =
    config.modelType === 'tx3_ntc'
      ? solveSteinhartHart(config.shPoints ?? defaultConfig.shPoints!)
      : null;

  return (
    <section
      aria-label="Sensor parameter and transfer curve calibration console"
      className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0D131A] overflow-hidden"
    >
      {/* Top Channel Selector Ribbon */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 dark:bg-[#101720]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Parameter & Raw Signal Transfer Curve Console
          </h2>
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Select sensor channel to calibrate"
        >
          {(Object.keys(configs) as SensorChannelId[]).map((id) => {
            const c = configs[id];
            const active = id === selectedChannelId;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectChannel(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {c.shortName} ({c.canIdHex})
              </button>
            );
          })}
        </div>
      </div>

      {/* Asymmetric Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Parameter Column (5 cols on lg) */}
        <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {config.canIdHex} · {config.mcuPin}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {config.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.sensorHardware}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onResetChannel(config.id)}
              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {/* Group 1: Interactive Signal Scrubber */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111923] space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.overrideEnabled}
                  onChange={(e) =>
                    onUpdateConfig(config.id, {
                      overrideEnabled: e.target.checked,
                      overrideAdcRaw: snapshot.adcRaw,
                    })
                  }
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>
                  {isRpm
                    ? 'Bench Pulse Frequency / Period Scrubber'
                    : 'Bench Raw Signal / Voltage Scrubber'}
                </span>
              </label>
              <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                {config.overrideEnabled ? 'Manual Override' : 'Live Stream'}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                <span>
                  {isRpm
                    ? 'Ignition Pulse Frequency (Hz)'
                    : 'Raw 12-bit ADC Count'}
                </span>
                <span className="font-semibold">
                  {isRpm
                    ? `${(snapshot.pulseHz ?? 0).toFixed(1)} Hz (${
                        snapshot.pulsePeriodMs?.toFixed(2) ?? '—'
                      } ms)`
                    : `${snapshot.adcRaw} / ${config.adcMaxCounts} (${snapshot.adcNormalizedPercent.toFixed(
                        1
                      )}%)`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={config.adcMaxCounts}
                value={snapshot.adcRaw}
                onChange={(e) =>
                  onUpdateConfig(config.id, {
                    overrideEnabled: true,
                    overrideAdcRaw: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {isRpm ? (
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Pulse Freq (Hz)
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="450"
                    value={Number((snapshot.pulseHz ?? 0).toFixed(1))}
                    onChange={(e) => {
                      const hz = parseFloat(e.target.value);
                      if (!Number.isNaN(hz) && hz >= 0) {
                        onUpdateConfig(config.id, {
                          overrideEnabled: true,
                          overrideAdcRaw: Math.round(
                            Math.min(config.adcMaxCounts, hz * 10)
                          ),
                        });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Period (ms)
                  </span>
                  <input
                    type="number"
                    step="0.25"
                    min="2.2"
                    max="250"
                    value={
                      snapshot.pulsePeriodMs !== null &&
                      snapshot.pulsePeriodMs !== undefined
                        ? Number(snapshot.pulsePeriodMs.toFixed(2))
                        : 10
                    }
                    onChange={(e) => {
                      const ms = parseFloat(e.target.value);
                      if (!Number.isNaN(ms) && ms > 0.5) {
                        const hz = 1000.0 / ms;
                        onUpdateConfig(config.id, {
                          overrideEnabled: true,
                          overrideAdcRaw: Math.round(
                            Math.min(config.adcMaxCounts, hz * 10)
                          ),
                        });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 block">
                    Reported (RPM)
                  </span>
                  <input
                    type="number"
                    step="50"
                    value={
                      snapshot.reportedValue !== null
                        ? Math.round(snapshot.reportedValue)
                        : ''
                    }
                    placeholder="Stalled"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) {
                        const nextAdc = reportedValueToAdc(
                          val,
                          config,
                          tempUnit
                        );
                        onUpdateConfig(config.id, {
                          overrideEnabled: true,
                          overrideAdcRaw: nextAdc,
                        });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1 rounded border border-cyan-500/50 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    ADC Pin (V)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={config.vRef}
                    value={Number(snapshot.vAdc.toFixed(3))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        const nextAdc = Math.round(
                          Math.max(
                            0,
                            Math.min(
                              config.adcMaxCounts,
                              (v / Math.max(0.1, config.vRef)) *
                                config.adcMaxCounts
                            )
                          )
                        );
                        onUpdateConfig(config.id, {
                          overrideEnabled: true,
                          overrideAdcRaw: nextAdc,
                        });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </label>

                {config.modelType === 'linear_voltage_divider' ? (
                  <label className="block">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Sender (V)
                    </span>
                    <input
                      type="number"
                      step="0.02"
                      min="0"
                      max="5.5"
                      value={Number(snapshot.vSender.toFixed(3))}
                      onChange={(e) => {
                        const vSender = parseFloat(e.target.value);
                        if (!Number.isNaN(vSender)) {
                          const vAdc = vSender * (config.dividerGain ?? 0.6);
                          const nextAdc = Math.round(
                            Math.max(
                              0,
                              Math.min(
                                config.adcMaxCounts,
                                (vAdc / Math.max(0.1, config.vRef)) *
                                  config.adcMaxCounts
                              )
                            )
                          );
                          onUpdateConfig(config.id, {
                            overrideEnabled: true,
                            overrideAdcRaw: nextAdc,
                          });
                        }
                      }}
                      className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Sensor R (Ω)
                    </span>
                    <input
                      type="number"
                      step={config.id === 'fuel_level' ? '0.5' : '10'}
                      min="0.5"
                      max="50000"
                      value={
                        snapshot.resistanceOhms !== null
                          ? Number(snapshot.resistanceOhms.toFixed(1))
                          : 0
                      }
                      onChange={(e) => {
                        const r = parseFloat(e.target.value);
                        if (!Number.isNaN(r) && r >= 0) {
                          const ratio = r / (config.pullupOhms + r);
                          const nextAdc = Math.round(
                            Math.max(
                              0,
                              Math.min(
                                config.adcMaxCounts,
                                ratio * config.adcMaxCounts
                              )
                            )
                          );
                          onUpdateConfig(config.id, {
                            overrideEnabled: true,
                            overrideAdcRaw: nextAdc,
                          });
                        }
                      }}
                      className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 block">
                    Reported ({unitLabel})
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={
                      snapshot.reportedValue !== null
                        ? Number(snapshot.reportedValue.toFixed(1))
                        : ''
                    }
                    placeholder="Fault"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) {
                        const nextAdc = reportedValueToAdc(
                          val,
                          config,
                          tempUnit
                        );
                        onUpdateConfig(config.id, {
                          overrideEnabled: true,
                          overrideAdcRaw: nextAdc,
                        });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1 rounded border border-cyan-500/50 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Group 2: Modifiable Gauge Min / Max & Warning / Critical Bounds */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              01. Modifiable Display Min/Max & Alert Thresholds ({unitLabel})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <label className="block">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Display Min ({unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={dispMin}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onUpdateConfig(config.id, {
                        displayMin: fromActiveUnit(v),
                      });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Display Max ({unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={dispMax}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onUpdateConfig(config.id, {
                        displayMax: fromActiveUnit(v),
                      });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
                  Target Min ({unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={toActiveUnit(config.targetMin) ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onUpdateConfig(config.id, {
                        targetMin: fromActiveUnit(v),
                      });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
                  Target Max ({unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={toActiveUnit(config.targetMax) ?? 100}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onUpdateConfig(config.id, {
                        targetMax: fromActiveUnit(v),
                      });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 block">
                  {config.id === 'fuel_level' ? 'Warn Low' : 'Warn High'} (
                  {unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={
                    (config.id === 'fuel_level'
                      ? toActiveUnit(config.warnLow)
                      : toActiveUnit(config.warnHigh)) ?? ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v =
                      raw === '' ? null : fromActiveUnit(parseFloat(raw));
                    if (config.id === 'fuel_level') {
                      onUpdateConfig(config.id, { warnLow: v });
                    } else {
                      onUpdateConfig(config.id, { warnHigh: v });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 block">
                  {config.id === 'fuel_level'
                    ? 'Critical Low'
                    : isRpm
                    ? 'Redline High'
                    : 'Critical High'}{' '}
                  ({unitLabel})
                </span>
                <input
                  type="number"
                  step={isRpm ? '100' : '1'}
                  value={
                    (config.id === 'fuel_level'
                      ? toActiveUnit(config.dangerLow)
                      : toActiveUnit(config.dangerHigh)) ?? ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v =
                      raw === '' ? null : fromActiveUnit(parseFloat(raw));
                    if (config.id === 'fuel_level') {
                      onUpdateConfig(config.id, { dangerLow: v });
                    } else {
                      onUpdateConfig(config.id, { dangerHigh: v });
                    }
                  }}
                  className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
            </div>
          </div>

          {/* Group 3: Underlying Electrical Circuit & Fault Threshold Parameters */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {isRpm
                ? '02. CoilX + Adafruit 757 BSS138 Digital Pulse Parameters'
                : '02. Electrical Frontend & ADC Fault Bounds'}
            </h4>
            {isRpm ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Pulses / Rev
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="36"
                    value={config.pulsesPerRev ?? 4}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v > 0) {
                        onUpdateConfig(config.id, { pulsesPerRev: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    757 LV A1 (V)
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    min="1.8"
                    max="5.0"
                    value={config.vRef}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v > 0) {
                        onUpdateConfig(config.id, { vRef: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Min Valid (Hz)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={config.minValidHz ?? 3.0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v >= 0) {
                        onUpdateConfig(config.id, { minValidHz: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Max Valid (Hz)
                  </span>
                  <input
                    type="number"
                    step="10"
                    min="100"
                    max="1000"
                    value={config.maxValidHz ?? 450}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v > 10) {
                        onUpdateConfig(config.id, { maxValidHz: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    ADC V_ref (V)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="2.5"
                    max="5.0"
                    value={config.vRef}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v > 0) {
                        onUpdateConfig(config.id, { vRef: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>

                {config.modelType === 'linear_voltage_divider' ? (
                  <label className="block">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Divider Gain
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1.0"
                      value={config.dividerGain ?? 0.6}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v > 0) {
                          onUpdateConfig(config.id, { dividerGain: v });
                        }
                      }}
                      className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Pull-up R (Ω)
                    </span>
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="50000"
                      value={config.pullupOhms}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v > 0) {
                          onUpdateConfig(config.id, { pullupOhms: v });
                        }
                      }}
                      className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Short ADC ≤
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="500"
                    value={config.adcShortThreshold}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { adcShortThreshold: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Open ADC ≥
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="3000"
                    max="4095"
                    value={config.adcOpenThreshold}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { adcOpenThreshold: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Group 4: Sensor-Specific Transfer Equation Parameters */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              03. Transfer Function & Calibration Curve Parameters
            </h4>

            {isRpm && (
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-mono space-y-1.5 text-slate-600 dark:text-slate-300">
                <div>
                  Equation:{' '}
                  <strong className="text-cyan-600 dark:text-cyan-400">
                    RPM = f_Hz × (60 / {config.pulsesPerRev ?? 4}) = f_Hz ×{' '}
                    {(60 / Math.max(0.5, config.pulsesPerRev ?? 4)).toFixed(2)}
                  </strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  EPLZON carrier header: E5–E10 / G5–G10 · Underside GND jumper:
                  D10–H10 · C2.4 (5V pulse) → 757 B1 · C2.9 (GND) → logic GND.
                </div>
              </div>
            )}

            {config.modelType === 'tx3_ntc' && config.shPoints && (
              <div className="space-y-2.5 text-xs font-mono">
                <div className="grid grid-cols-3 gap-2">
                  {([0, 1, 2] as const).map((idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Fit Point {idx + 1}
                      </div>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 block">
                          Temp (°C)
                        </span>
                        <input
                          type="number"
                          step="1"
                          value={config.shPoints![idx].tempC}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) {
                              updateSteinhartPoint(idx, { tempC: v });
                            }
                          }}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 block">
                          R (Ω)
                        </span>
                        <input
                          type="number"
                          step="10"
                          min="1"
                          value={config.shPoints![idx].resistanceOhms}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v > 0) {
                              updateSteinhartPoint(idx, { resistanceOhms: v });
                            }
                          }}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  ))}
                </div>
                {shCoeffs && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap justify-between gap-2 pt-1">
                    <span>A: {shCoeffs.a.toExponential(4)}</span>
                    <span>B: {shCoeffs.b.toExponential(4)}</span>
                    <span>C: {shCoeffs.c.toExponential(4)}</span>
                  </div>
                )}
              </div>
            )}

            {config.modelType === 'fg72a_resistance' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Empty 0% (Ω)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={config.emptyOhms ?? 75}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { emptyOhms: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Full 100% (Ω)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={config.fullOhms ?? 10}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { fullOhms: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Min Valid (Ω)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={config.minValidOhms ?? 5}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { minValidOhms: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Max Valid (Ω)
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={config.maxValidOhms ?? 100}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { maxValidOhms: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>
            )}

            {config.modelType === 'linear_voltage_divider' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Zero V_0 (V)
                  </span>
                  <input
                    type="number"
                    step="0.005"
                    value={config.zeroOffsetVolts ?? 0.485}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { zeroOffsetVolts: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Slope (PSI/V)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={config.slopePsiPerVolt ?? 7.3663}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { slopePsiPerVolt: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Min V_sender
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    value={config.minValidSenderVolts ?? 0.25}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { minValidSenderVolts: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Max V_sender
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    value={config.maxValidSenderVolts ?? 4.8}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onUpdateConfig(config.id, { maxValidSenderVolts: v });
                      }
                    }}
                    className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right Interactive Transfer Curve & Raw-vs-Reported Analysis Stage (7 cols on lg) */}
        <div className="lg:col-span-7 p-5 flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Reported Value ({unitLabel}) vs. Underlying Raw Source
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solid cyan: Active calibration · Dashed slate: Factory firmware baseline
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(isRpm
                ? ([
                    { id: 'pulse_hz', label: 'Pulse Freq (Hz)' },
                    { id: 'pulse_ms', label: 'Pulse Period (ms)' },
                  ] as { id: XAxisMode; label: string }[])
                : ([
                    { id: 'v_adc', label: 'ADC Pin (V)' },
                    { id: 'v_sender', label: 'Sender (V)' },
                    ...(config.modelType !== 'linear_voltage_divider'
                      ? [{ id: 'resistance', label: 'Resistance (Ω)' }]
                      : []),
                    { id: 'adc_raw', label: '12-bit ADC' },
                  ] as { id: XAxisMode; label: string }[])
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setXAxisMode(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    effectiveXAxis === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive SVG Transfer Curve Plot */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-[#090E14] p-3">
            <svg
              viewBox={`0 0 ${chartGeom.W} ${chartGeom.H}`}
              className="w-full h-60 overflow-visible select-none"
              role="img"
              aria-label={`Transfer curve for ${config.name}`}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const yVal =
                  chartGeom.minY + t * (chartGeom.maxY - chartGeom.minY);
                const sy = chartGeom.toSvgY(yVal);
                return (
                  <g key={t}>
                    <line
                      x1={chartGeom.padL}
                      y1={sy}
                      x2={chartGeom.W - chartGeom.padR}
                      y2={sy}
                      className="stroke-slate-200 dark:stroke-slate-800/90"
                      strokeWidth="1"
                    />
                    <text
                      x={chartGeom.padL - 8}
                      y={sy + 4}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                    >
                      {yVal.toFixed(0)} {unitLabel}
                    </text>
                  </g>
                );
              })}

              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const xVal =
                  chartGeom.minX + t * (chartGeom.maxX - chartGeom.minX);
                const sx = chartGeom.toSvgX(xVal);
                const label =
                  effectiveXAxis === 'pulse_hz'
                    ? `${xVal.toFixed(0)}Hz`
                    : effectiveXAxis === 'pulse_ms'
                    ? `${xVal.toFixed(1)}ms`
                    : effectiveXAxis === 'adc_raw'
                    ? xVal.toFixed(0)
                    : effectiveXAxis === 'resistance'
                    ? `${xVal.toFixed(0)}Ω`
                    : `${xVal.toFixed(2)}V`;
                return (
                  <g key={t}>
                    <line
                      x1={sx}
                      y1={chartGeom.padT}
                      x2={sx}
                      y2={chartGeom.H - chartGeom.padB}
                      className="stroke-slate-200 dark:stroke-slate-800/80"
                      strokeWidth="1"
                    />
                    <text
                      x={sx}
                      y={chartGeom.H - 12}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {(() => {
                const tMin = toActiveUnit(config.targetMin) ?? chartGeom.minY;
                const tMax = toActiveUnit(config.targetMax) ?? chartGeom.maxY;
                const yTop = chartGeom.toSvgY(tMax);
                const yBot = chartGeom.toSvgY(tMin);
                return (
                  <rect
                    x={chartGeom.padL}
                    y={Math.min(yTop, yBot)}
                    width={chartGeom.plotW}
                    height={Math.max(2, Math.abs(yBot - yTop))}
                    className="fill-emerald-500/10 stroke-emerald-500/30"
                    strokeDasharray="3 3"
                  />
                );
              })()}

              {chartGeom.factoryPath && (
                <path
                  d={chartGeom.factoryPath}
                  fill="none"
                  className="stroke-slate-400 dark:stroke-slate-500"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {chartGeom.activePath && (
                <path
                  d={chartGeom.activePath}
                  fill="none"
                  className="stroke-cyan-600 dark:stroke-cyan-400"
                  strokeWidth="2.25"
                />
              )}

              <g>
                <line
                  x1={chartGeom.liveSvgX}
                  y1={chartGeom.padT}
                  x2={chartGeom.liveSvgX}
                  y2={chartGeom.H - chartGeom.padB}
                  className="stroke-amber-500/70"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                {snapshot.valid && snapshot.reportedValue !== null && (
                  <>
                    <line
                      x1={chartGeom.padL}
                      y1={chartGeom.liveSvgY}
                      x2={chartGeom.W - chartGeom.padR}
                      y2={chartGeom.liveSvgY}
                      className="stroke-amber-500/70"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={chartGeom.liveSvgX}
                      cy={chartGeom.liveSvgY}
                      r="5"
                      className="fill-amber-400 stroke-slate-950"
                      strokeWidth="2"
                    />
                  </>
                )}
              </g>
            </svg>

            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                {isRpm ? (
                  <>
                    <span>
                      <strong className="text-slate-900 dark:text-white">
                        Operating Point:
                      </strong>{' '}
                      {(snapshot.pulseHz ?? 0).toFixed(1)} Hz
                    </span>
                    <span>·</span>
                    <span>
                      Period:{' '}
                      {snapshot.pulsePeriodMs !== null &&
                      snapshot.pulsePeriodMs !== undefined
                        ? `${snapshot.pulsePeriodMs.toFixed(2)} ms (${snapshot.pulsePeriodUs} µs)`
                        : '—'}
                    </span>
                    <span>·</span>
                    <span>
                      B1 {snapshot.vSender.toFixed(1)}V → A1{' '}
                      {snapshot.vAdc.toFixed(1)}V
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <strong className="text-slate-900 dark:text-white">
                        Operating Point:
                      </strong>{' '}
                      ADC {snapshot.adcRaw}
                    </span>
                    <span>·</span>
                    <span>Pin {snapshot.vAdc.toFixed(4)} V</span>
                    {config.modelType === 'linear_voltage_divider' ? (
                      <>
                        <span>·</span>
                        <span>Sender {snapshot.vSender.toFixed(3)} V</span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span>
                          {snapshot.resistanceOhms !== null
                            ? `${snapshot.resistanceOhms.toFixed(1)} Ω`
                            : 'Fault Ω'}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                  Reported:{' '}
                  {snapshot.valid && snapshot.reportedValue !== null
                    ? `${snapshot.reportedValue.toFixed(
                        isRpm ? 0 : 1
                      )} ${unitLabel}`
                    : snapshot.statusText}
                </span>
                {snapshot.nominalReportedValue !== null && (
                  <span className="text-slate-500 dark:text-slate-400">
                    (Factory:{' '}
                    {snapshot.nominalReportedValue.toFixed(isRpm ? 0 : 1)}{' '}
                    {unitLabel})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Multi-Point Reference Comparison Table & Firmware C Header Export */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-500" />
                  {isRpm
                    ? 'Bring-Up Pulse Hz vs. RPM Reference Table'
                    : 'Raw vs. Reported Reference Table'}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Click row to test point
                </span>
              </div>
              <div className="overflow-x-auto max-h-44">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-900/40">
                      <th className="py-1.5 px-2.5">
                        {isRpm ? 'Pulse Hz' : 'ADC'}
                      </th>
                      <th className="py-1.5 px-2.5">
                        {isRpm ? 'Period' : 'Pin V'}
                      </th>
                      <th className="py-1.5 px-2.5">
                        {isRpm
                          ? '757 A1 / B1'
                          : config.modelType === 'linear_voltage_divider'
                          ? 'Sender V'
                          : 'Sensor Ω'}
                      </th>
                      <th className="py-1.5 px-2.5">Factory</th>
                      <th className="py-1.5 px-2.5 text-cyan-600 dark:text-cyan-400">
                        Reported
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                    {lookupRows.map((row) => (
                      <tr
                        key={row.adcRaw}
                        onClick={() =>
                          onUpdateConfig(config.id, {
                            overrideEnabled: true,
                            overrideAdcRaw: row.adcRaw,
                          })
                        }
                        className="hover:bg-cyan-500/10 cursor-pointer transition-colors"
                      >
                        <td className="py-1.5 px-2.5">
                          {isRpm
                            ? `${(row.pulseHz ?? 0).toFixed(1)} Hz`
                            : row.adcRaw}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {isRpm
                            ? `${row.pulsePeriodMs?.toFixed(2) ?? '—'} ms`
                            : `${row.vAdc.toFixed(3)} V`}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {isRpm
                            ? `${row.vAdc.toFixed(1)}V / ${row.vSender.toFixed(
                                1
                              )}V`
                            : config.modelType === 'linear_voltage_divider'
                            ? `${row.vSender.toFixed(3)} V`
                            : row.resistanceOhms !== null
                            ? `${row.resistanceOhms.toFixed(1)} Ω`
                            : '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-500">
                          {row.nominalReportedValue !== null
                            ? `${row.nominalReportedValue.toFixed(
                                isRpm ? 0 : 1
                              )} ${unitLabel}`
                            : 'Fault'}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          {row.valid && row.reportedValue !== null
                            ? `${row.reportedValue.toFixed(
                                isRpm ? 0 : 1
                              )} ${unitLabel}`
                            : row.statusText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-5 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between bg-slate-50/50 dark:bg-[#090E14]">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                  STM32 Firmware Defines
                </span>
                <button
                  type="button"
                  onClick={handleCopyDefines}
                  className="px-2 py-0.5 text-[11px] font-mono rounded border border-slate-300 dark:border-slate-700 hover:border-cyan-500 flex items-center gap-1"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy .h</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto leading-relaxed">
                {generatedCDefines}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
