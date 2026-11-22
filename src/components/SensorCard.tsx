import React, { useState } from 'react';
import {
  ComputedSensorSnapshot,
  PrimaryDisplaySource,
  SensorParameterConfig,
  TemperatureUnit,
} from '../types/telemetry';
import { cToF, fToC } from '../utils/sensorMath';
import { Sliders, RotateCcw, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';

interface SensorCardProps {
  config: SensorParameterConfig;
  snapshot: ComputedSensorSnapshot;
  history: (number | null)[];
  primarySource: PrimaryDisplaySource;
  tempUnit: TemperatureUnit;
  isSelectedForCalibration: boolean;
  isEditingLayout: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelectForCalibration: () => void;
  onUpdateConfig: (patch: Partial<SensorParameterConfig>) => void;
  onResetChannel: () => void;
  onMoveCard: (dir: -1 | 1) => void;
  onHideCard: () => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  config,
  snapshot,
  history,
  primarySource,
  tempUnit,
  isSelectedForCalibration,
  isEditingLayout,
  canMoveUp,
  canMoveDown,
  onSelectForCalibration,
  onUpdateConfig,
  onResetChannel,
  onMoveCard,
  onHideCard,
}) => {
  const [editingMinMax, setEditingMinMax] = useState(false);

  const isCoolant = config.modelType === 'tx3_ntc';
  const isRpm = config.modelType === 'coilx_pulse_rpm';
  const unitLabel = isCoolant ? `°${tempUnit}` : snapshot.reportedUnit;

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
  const targetMin = toActiveUnit(config.targetMin) ?? 0;
  const targetMax = toActiveUnit(config.targetMax) ?? 100;
  const warnHigh = toActiveUnit(config.warnHigh);
  const dangerHigh = toActiveUnit(config.dangerHigh);
  const warnLow = toActiveUnit(config.warnLow);

  const span = Math.max(0.001, config.displayMax - config.displayMin);
  const posPct = (nativeVal: number | null) => {
    if (nativeVal === null) return null;
    return Math.max(
      0,
      Math.min(100, ((nativeVal - config.displayMin) / span) * 100)
    );
  };

  const targetStartPct = posPct(config.targetMin) ?? 0;
  const targetEndPct = posPct(config.targetMax) ?? 100;
  const warnHighPct = posPct(config.warnHigh);
  const dangerHighPct = posPct(config.dangerHigh);
  const warnLowPct = posPct(config.warnLow);

  const getPrimaryPresentation = () => {
    if (!snapshot.fresh) {
      return { main: '—', unit: unitLabel, sub: 'No recent CAN frames' };
    }

    if (isRpm) {
      const hz = snapshot.pulseHz ?? 0;
      const periodMs = snapshot.pulsePeriodMs;
      if (primarySource === 'adc_raw') {
        return {
          main: `${hz.toFixed(1)}`,
          unit: 'Hz (A1 Pulse)',
          sub:
            periodMs !== null
              ? `Period: ${periodMs.toFixed(2)} ms (${snapshot.pulsePeriodUs} µs) · ${
                  snapshot.reportedValue?.toFixed(0) ?? '—'
                } RPM`
              : `Fault: ${snapshot.statusText}`,
        };
      }
      if (primarySource === 'v_adc') {
        return {
          main: `${snapshot.vAdc.toFixed(2)}`,
          unit: 'V (757 A1 LV)',
          sub: `${hz.toFixed(1)} Hz pulse train · ${
            snapshot.reportedValue?.toFixed(0) ?? '—'
          } RPM`,
        };
      }
      if (primarySource === 'v_sender') {
        return {
          main: `${snapshot.vSender.toFixed(2)}`,
          unit: 'V (CoilX B1 HV)',
          sub: `Stepped to ${snapshot.vAdc.toFixed(2)} V at A1 · ${hz.toFixed(
            1
          )} Hz`,
        };
      }
      if (primarySource === 'resistance') {
        return {
          main: periodMs !== null ? periodMs.toFixed(2) : '—',
          unit: 'ms / pulse',
          sub: `${hz.toFixed(1)} Hz (${
            config.pulsesPerRev ?? 4
          } pulses/rev) · ${snapshot.reportedValue?.toFixed(0) ?? '—'} RPM`,
        };
      }
      if (!snapshot.valid || snapshot.reportedValue === null) {
        return {
          main: '—',
          unit: 'RPM',
          sub: `${snapshot.statusText} · ${hz.toFixed(1)} Hz`,
        };
      }
      return {
        main: snapshot.reportedValue.toFixed(0),
        unit: 'RPM',
        sub: `${hz.toFixed(1)} Hz · ${
          periodMs !== null ? `${periodMs.toFixed(2)} ms` : '—'
        } · ${config.pulsesPerRev ?? 4} pulses/rev`,
      };
    }

    if (primarySource === 'adc_raw') {
      return {
        main: `${snapshot.adcRaw}`,
        unit: `/ ${config.adcMaxCounts} ADC`,
        sub: snapshot.valid
          ? `Reported: ${snapshot.reportedValue?.toFixed(1)} ${unitLabel} · ${snapshot.vAdc.toFixed(3)} V`
          : `Fault: ${snapshot.statusText}`,
      };
    }

    if (primarySource === 'v_adc') {
      return {
        main: snapshot.vAdc.toFixed(3),
        unit: 'V (ADC Pin)',
        sub: snapshot.valid
          ? `Reported: ${snapshot.reportedValue?.toFixed(1)} ${unitLabel} · ADC ${snapshot.adcRaw}`
          : `Fault: ${snapshot.statusText} · ADC ${snapshot.adcRaw}`,
      };
    }

    if (primarySource === 'v_sender') {
      return {
        main: snapshot.vSender.toFixed(3),
        unit: 'V (Sender)',
        sub:
          config.modelType === 'linear_voltage_divider'
            ? `Pin: ${snapshot.vAdc.toFixed(3)} V (×${(config.dividerGain ?? 0.6).toFixed(2)}) · Reported: ${
                snapshot.valid && snapshot.reportedValue !== null
                  ? `${snapshot.reportedValue.toFixed(1)} PSI`
                  : snapshot.statusText
              }`
            : `Direct pull-up (${config.pullupOhms} Ω) · Reported: ${
                snapshot.valid && snapshot.reportedValue !== null
                  ? `${snapshot.reportedValue.toFixed(1)} ${unitLabel}`
                  : snapshot.statusText
              }`,
      };
    }

    if (primarySource === 'resistance') {
      if (snapshot.resistanceOhms !== null) {
        return {
          main:
            snapshot.resistanceOhms >= 1000
              ? snapshot.resistanceOhms.toFixed(0)
              : snapshot.resistanceOhms.toFixed(1),
          unit: 'Ω',
          sub: snapshot.valid
            ? `Reported: ${snapshot.reportedValue?.toFixed(1)} ${unitLabel} · ${snapshot.vAdc.toFixed(3)} V`
            : `Fault: ${snapshot.statusText}`,
        };
      }
      return {
        main: snapshot.vSender.toFixed(3),
        unit: 'V (3-Wire)',
        sub: `Voltage sender (250 kΩ load) · Reported: ${
          snapshot.valid && snapshot.reportedValue !== null
            ? `${snapshot.reportedValue.toFixed(1)} PSI`
            : snapshot.statusText
        }`,
      };
    }

    if (!snapshot.valid || snapshot.reportedValue === null) {
      return {
        main: '—',
        unit: unitLabel,
        sub: `${snapshot.statusText} · ADC ${snapshot.adcRaw} (${snapshot.vAdc.toFixed(3)} V)`,
      };
    }

    const decimals = config.id === 'fuel_level' ? 0 : 1;
    return {
      main: snapshot.reportedValue.toFixed(decimals),
      unit: config.id === 'fuel_level' ? '% Est.' : unitLabel,
      sub:
        isCoolant && snapshot.reportedSecondaryValue !== null
          ? `${snapshot.reportedSecondaryValue.toFixed(1)} ${snapshot.reportedSecondaryUnit}`
          : config.id === 'fuel_level' && snapshot.resistanceOhms !== null
          ? `${snapshot.resistanceOhms.toFixed(1)} Ω sender resistance`
          : `${snapshot.vSender.toFixed(3)} V sender (${snapshot.vAdc.toFixed(3)} V pin)`,
    };
  };

  const pres = getPrimaryPresentation();

  const getStatusIndicator = () => {
    if (!snapshot.fresh) {
      return {
        glyph: '○',
        text: 'Stale / Waiting',
        colorClass: 'text-slate-500 dark:text-slate-400',
      };
    }
    if (!snapshot.valid || snapshot.alertState === 'fault') {
      return {
        glyph: '✖',
        text: snapshot.statusText,
        colorClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      };
    }
    if (snapshot.alertState === 'danger') {
      return {
        glyph: '✖',
        text: isRpm ? 'Redline Limit Exceeded' : 'Critical Bound Exceeded',
        colorClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      };
    }
    if (snapshot.alertState === 'warning') {
      return {
        glyph: '▲',
        text: 'Outside Target Range',
        colorClass: 'text-amber-600 dark:text-amber-400 font-medium',
      };
    }
    return {
      glyph: '●',
      text: isRpm
        ? 'CoilX + 757 Pulse Ready'
        : config.isProvisional
        ? 'Provisional Fit Online'
        : 'Sensor Nominal',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
    };
  };

  const statusInfo = getStatusIndicator();

  const buildSparklinePath = () => {
    const validPts = history
      .map((val, idx) => ({ val, idx }))
      .filter((p) => p.val !== null) as { val: number; idx: number }[];
    if (validPts.length < 2) return '';

    const minBound = dispMin;
    const maxBound = Math.max(minBound + 1, dispMax);
    let d = '';
    let move = true;
    history.forEach((rawVal, i) => {
      if (rawVal === null) {
        move = true;
        return;
      }
      const x = (i / Math.max(1, history.length - 1)) * 296 + 2;
      const clamped = Math.max(minBound, Math.min(maxBound, rawVal));
      const y = 52 - ((clamped - minBound) / (maxBound - minBound)) * 44;
      d += `${move ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
      move = false;
    });
    return d;
  };

  const sparkPath = buildSparklinePath();

  const barColorClass =
    snapshot.alertState === 'danger' || snapshot.alertState === 'fault'
      ? 'bg-rose-500'
      : snapshot.alertState === 'warning'
      ? 'bg-amber-500'
      : 'bg-cyan-500 dark:bg-cyan-400';

  return (
    <article
      className={`border transition-colors rounded-lg p-5 bg-white dark:bg-[#0D131A] ${
        isSelectedForCalibration
          ? 'border-cyan-600 dark:border-cyan-400'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {isEditingLayout && (
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Card Order & Visibility
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMoveCard(-1)}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 hover:border-cyan-500 whitespace-nowrap shrink-0"
              aria-label={`Move ${config.name} earlier`}
            >
              <ArrowUp className="w-3.5 h-3.5 inline mr-1" />
              Earlier
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMoveCard(1)}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 hover:border-cyan-500 whitespace-nowrap shrink-0"
              aria-label={`Move ${config.name} later`}
            >
              <ArrowDown className="w-3.5 h-3.5 inline mr-1" />
              Later
            </button>
            <button
              type="button"
              onClick={onHideCard}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:border-rose-500 whitespace-nowrap shrink-0"
            >
              <EyeOff className="w-3.5 h-3.5 inline mr-1" />
              Hide
            </button>
          </div>
        </div>
      )}

      {/* Header Metadata (Zero-Pill Unboxed Discipline) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>CAN {config.canIdHex}</span>
            <span aria-hidden="true">·</span>
            <span>{config.mcuPin}</span>
            {config.overrideEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Manual Raw Override
                </span>
              </>
            )}
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {config.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {config.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setEditingMinMax((v) => !v)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
              editingMinMax
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
            title="Modify gauge min/max & warning thresholds"
          >
            Min/Max
          </button>
          <button
            type="button"
            onClick={onSelectForCalibration}
            className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              isSelectedForCalibration
                ? 'bg-cyan-600 text-white border-cyan-600 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-cyan-500'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Calibrate</span>
          </button>
        </div>
      </div>

      {/* Primary Metric & Raw-vs-Reported Comparison Grid */}
      {primarySource === 'comparison' ? (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Reported Value
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 font-mono tabular-nums">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                {snapshot.valid && snapshot.reportedValue !== null
                  ? snapshot.reportedValue.toFixed(
                      config.id === 'fuel_level' || isRpm ? 0 : 1
                    )
                  : '—'}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {unitLabel}
              </span>
            </div>
            {snapshot.calibrationDelta !== null &&
              Math.abs(snapshot.calibrationDelta) >= 0.05 && (
                <div className="mt-1 text-xs font-mono text-amber-600 dark:text-amber-400">
                  Δ {snapshot.calibrationDelta > 0 ? '+' : ''}
                  {snapshot.calibrationDelta.toFixed(isRpm ? 0 : 1)}{' '}
                  {unitLabel} vs. factory
                </div>
              )}
          </div>

          <div className="border-l border-slate-200 dark:border-slate-800 pl-4 space-y-1 font-mono text-xs tabular-nums">
            {isRpm ? (
              <>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    Pulse Freq:
                  </span>
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    {(snapshot.pulseHz ?? 0).toFixed(1)} Hz
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    Period:
                  </span>
                  <span className="font-semibold">
                    {snapshot.pulsePeriodMs !== null &&
                    snapshot.pulsePeriodMs !== undefined
                      ? `${snapshot.pulsePeriodMs.toFixed(2)} ms`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    B1 → A1:
                  </span>
                  <span>
                    {snapshot.vSender.toFixed(1)}V → {snapshot.vAdc.toFixed(1)}V (
                    {config.pulsesPerRev ?? 4} PPR)
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    ADC Pin:
                  </span>
                  <span className="font-semibold">
                    {snapshot.vAdc.toFixed(4)} V
                  </span>
                </div>
                {config.modelType === 'linear_voltage_divider' ? (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">
                      Sender V:
                    </span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {snapshot.vSender.toFixed(3)} V
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">
                      Sensor R:
                    </span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {snapshot.resistanceOhms !== null
                        ? `${snapshot.resistanceOhms.toFixed(1)} Ω`
                        : '—'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    Raw 12b:
                  </span>
                  <span>
                    {snapshot.adcRaw} / {config.adcMaxCounts} (
                    {snapshot.adcNormalizedPercent.toFixed(1)}%)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {pres.main}
            </span>
            <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
              {pres.unit}
            </span>
          </div>
          <div className="text-right">
            <div className={`text-xs font-mono ${statusInfo.colorClass}`}>
              {statusInfo.glyph} {statusInfo.text}
            </div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {pres.sub}
            </div>
          </div>
        </div>
      )}

      {/* Gauge Track with Target Band & Threshold Markers */}
      <div className="mt-4">
        <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800/90 rounded overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/15 dark:bg-emerald-400/15 border-x border-emerald-500/40"
            style={{
              left: `${targetStartPct}%`,
              width: `${Math.max(0, targetEndPct - targetStartPct)}%`,
            }}
            title={`Nominal target band: ${targetMin}–${targetMax} ${unitLabel}`}
          />

          {warnLowPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
              style={{ left: `${warnLowPct}%` }}
              title={`Low Warning: ${warnLow} ${unitLabel}`}
            />
          )}
          {warnHighPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
              style={{ left: `${warnHighPct}%` }}
              title={`High Warning: ${warnHigh} ${unitLabel}`}
            />
          )}
          {dangerHighPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
              style={{ left: `${dangerHighPct}%` }}
              title={`Critical High: ${dangerHigh} ${unitLabel}`}
            />
          )}

          {snapshot.valid && (
            <div
              className={`h-full transition-transform duration-150 origin-left ${barColorClass}`}
              style={{
                width: '100%',
                transform: `scaleX(${(snapshot.gaugePercent / 100).toFixed(4)})`,
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums">
          <span>
            Min {dispMin} {unitLabel}
          </span>
          <span>
            Target {targetMin}–{targetMax} {unitLabel}
          </span>
          {warnHigh !== null ? (
            <span className="text-amber-600 dark:text-amber-400">
              Warn {warnHigh}
            </span>
          ) : warnLow !== null ? (
            <span className="text-amber-600 dark:text-amber-400">
              Warn ≤{warnLow}
            </span>
          ) : null}
          <span>
            Max {dispMax} {unitLabel}
          </span>
        </div>
      </div>

      {/* Inline Quick Min/Max & Threshold Editor */}
      {editingMinMax && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 -mx-5 px-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Gauge Range & Alert Thresholds ({unitLabel})
            </span>
            <button
              type="button"
              onClick={onResetChannel}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset defaults
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-mono">
            <label className="block">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Gauge Min
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={dispMin}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) {
                    onUpdateConfig({ displayMin: fromActiveUnit(v) });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Target Min
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={targetMin}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) {
                    onUpdateConfig({ targetMin: fromActiveUnit(v) });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Target Max
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={targetMax}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) {
                    onUpdateConfig({ targetMax: fromActiveUnit(v) });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block">
                {config.id === 'fuel_level' ? 'Warn Low' : 'Warn High'}
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={
                  (config.id === 'fuel_level' ? warnLow : warnHigh) ?? ''
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  const v = raw === '' ? null : fromActiveUnit(parseFloat(raw));
                  if (config.id === 'fuel_level') {
                    onUpdateConfig({ warnLow: v });
                  } else {
                    onUpdateConfig({ warnHigh: v });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 block">
                {config.id === 'fuel_level'
                  ? 'Crit Low'
                  : isRpm
                  ? 'Redline'
                  : 'Crit High'}
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={
                  (config.id === 'fuel_level'
                    ? toActiveUnit(config.dangerLow)
                    : dangerHigh) ?? ''
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  const v = raw === '' ? null : fromActiveUnit(parseFloat(raw));
                  if (config.id === 'fuel_level') {
                    onUpdateConfig({ dangerLow: v });
                  } else {
                    onUpdateConfig({ dangerHigh: v });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Gauge Max
              </span>
              <input
                type="number"
                step={isRpm ? '100' : '1'}
                value={dispMax}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) {
                    onUpdateConfig({ displayMax: fromActiveUnit(v) });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          {/* Direct Raw ADC / Frequency / Voltage Override Scrubber */}
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.overrideEnabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      overrideEnabled: e.target.checked,
                      overrideAdcRaw: snapshot.adcRaw,
                    })
                  }
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>
                  {isRpm
                    ? 'Override Bench Pulse Frequency (Hz)'
                    : 'Override Raw ADC / Pin Voltage'}
                </span>
              </label>

              {config.overrideEnabled && (
                <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                  <input
                    type="range"
                    min={0}
                    max={config.adcMaxCounts}
                    value={config.overrideAdcRaw}
                    onChange={(e) =>
                      onUpdateConfig({
                        overrideAdcRaw: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {isRpm
                      ? `${(config.overrideAdcRaw / 10).toFixed(1)} Hz`
                      : `ADC ${config.overrideAdcRaw} (${snapshot.vAdc.toFixed(
                          3
                        )} V)`}
                  </span>
                </div>
              )}
            </div>

            {/* One-click 100/200/400 Hz bench verification presets for RPM (from docs/rpm-input.md) */}
            {isRpm && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-mono text-slate-500">
                  Bring-up test points:
                </span>
                {[
                  { label: 'Idle 43.3 Hz (650)', deciHz: 433 },
                  { label: '100 Hz (1500 RPM)', deciHz: 1000 },
                  { label: '200 Hz (3000 RPM)', deciHz: 2000 },
                  { label: '400 Hz (6000 RPM)', deciHz: 4000 },
                ].map((pt) => (
                  <button
                    key={pt.deciHz}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        overrideEnabled: true,
                        overrideAdcRaw: pt.deciHz,
                      })
                    }
                    className="px-2 py-0.5 text-[11px] font-mono rounded border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200"
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sparkline & Underlying Electrical Strip */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <svg
          className={`w-full h-11 overflow-visible ${
            !snapshot.valid ? 'opacity-30' : ''
          }`}
          viewBox="0 0 300 54"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${config.name} recent trend`}
        >
          <line
            x1="0"
            y1="52"
            x2="300"
            y2="52"
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />
          {sparkPath && (
            <path
              d={sparkPath}
              fill="none"
              className={
                snapshot.alertState === 'danger'
                  ? 'stroke-rose-500'
                  : snapshot.alertState === 'warning'
                  ? 'stroke-amber-500'
                  : 'stroke-cyan-600 dark:stroke-cyan-400'
              }
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          <div className="flex items-center gap-2">
            {isRpm ? (
              <>
                <span>{(snapshot.pulseHz ?? 0).toFixed(1)} Hz</span>
                <span aria-hidden="true">·</span>
                <span>
                  {snapshot.pulsePeriodMs !== null &&
                  snapshot.pulsePeriodMs !== undefined
                    ? `${snapshot.pulsePeriodMs.toFixed(2)} ms`
                    : '— ms'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  B1 {snapshot.vSender.toFixed(1)}V → A1{' '}
                  {snapshot.vAdc.toFixed(1)}V
                </span>
              </>
            ) : (
              <>
                <span>ADC {snapshot.adcRaw}</span>
                <span aria-hidden="true">·</span>
                <span>{snapshot.vAdc.toFixed(3)} V pin</span>
                <span aria-hidden="true">·</span>
                {snapshot.resistanceOhms !== null ? (
                  <span>{snapshot.resistanceOhms.toFixed(1)} Ω</span>
                ) : (
                  <span>{snapshot.vSender.toFixed(3)} V sender</span>
                )}
              </>
            )}
          </div>
          <span
            className="text-[11px] text-slate-400 dark:text-slate-500"
            title="Encoded 8-byte CAN frame payload"
          >
            [{snapshot.canPayloadHex}]
          </span>
        </div>
      </div>
    </article>
  );
};
