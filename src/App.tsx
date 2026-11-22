import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CanFrameRecord,
  ComputedSensorSnapshot,
  PrimaryDisplaySource,
  SensorChannelId,
  SensorParameterConfig,
  SimulationScenario,
  TemperatureUnit,
} from './types/telemetry';
import {
  DEFAULT_SENSOR_CONFIGS,
  evaluateSensorAdc,
} from './utils/sensorMath';
import { SensorCard } from './components/SensorCard';
import { CalibrationConsole } from './components/CalibrationConsole';
import { RawCanInspector } from './components/RawCanInspector';
import {
  Download,
  RotateCcw,
  Sun,
  Moon,
  LayoutGrid,
  Plus,
  Smartphone,
} from 'lucide-react';

const CONFIG_STORAGE_KEY = 'vancan-sensor-configs-v4';
const ORDER_STORAGE_KEY = 'vancan-card-order-v4';
const UNIT_STORAGE_KEY = 'vancan-unit';

const ALL_CHANNEL_IDS: SensorChannelId[] = [
  'coolant_pre',
  'coolant_post',
  'fuel_level',
  'engine_rpm',
  'fuel_pressure_low',
  'oil_pressure',
  'fuel_pressure_high',
];

function loadSavedConfigs(): Record<SensorChannelId, SensorParameterConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SENSOR_CONFIGS);
    const parsed = JSON.parse(raw);
    const merged = structuredClone(DEFAULT_SENSOR_CONFIGS);
    for (const id of ALL_CHANNEL_IDS) {
      if (parsed[id]) {
        merged[id] = {
          ...merged[id],
          ...parsed[id],
          id,
        };
      }
    }
    return merged;
  } catch {
    return structuredClone(DEFAULT_SENSOR_CONFIGS);
  }
}

function loadSavedOrder(): SensorChannelId[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [...ALL_CHANNEL_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_CHANNEL_IDS];
    const valid = parsed.filter((id): id is SensorChannelId =>
      ALL_CHANNEL_IDS.includes(id)
    );
    for (const id of ALL_CHANNEL_IDS) {
      if (!valid.includes(id)) valid.push(id);
    }
    return valid;
  } catch {
    return [...ALL_CHANNEL_IDS];
  }
}

function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
    2,
    '0'
  )}:${String(secs).padStart(2, '0')}`;
}

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>(() => {
    try {
      return localStorage.getItem(UNIT_STORAGE_KEY) === 'C' ? 'C' : 'F';
    } catch {
      return 'F';
    }
  });
  const [primarySource, setPrimarySource] =
    useState<PrimaryDisplaySource>('comparison');
  const [scenario, setScenario] = useState<SimulationScenario>('live');
  const [configs, setConfigs] =
    useState<Record<SensorChannelId, SensorParameterConfig>>(loadSavedConfigs);
  const [cardOrder, setCardOrder] =
    useState<SensorChannelId[]>(loadSavedOrder);
  const [selectedCalChannel, setSelectedCalChannel] =
    useState<SensorChannelId>('engine_rpm');
  const [isEditingLayout, setIsEditingLayout] = useState<boolean>(false);

  // Simulation clock & rolling buffers
  const [tick, setTick] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const historiesRef = useRef<Record<SensorChannelId, (number | null)[]>>({
    coolant_pre: [],
    coolant_post: [],
    fuel_level: [],
    engine_rpm: [],
    fuel_pressure_low: [],
    oil_pressure: [],
    fuel_pressure_high: [],
  });
  const framesRef = useRef<CanFrameRecord[]>([]);
  const frameSeqRef = useRef<number>(1400);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist config & unit updates
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs));
    } catch {
      // ignore storage errors
    }
  }, [configs]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(cardOrder));
    } catch {
      // ignore storage errors
    }
  }, [cardOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, tempUnit);
    } catch {
      // ignore storage errors
    }
  }, [tempUnit]);

  // 250ms telemetry loop matching STM32 firmware transmission cadence
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const updateChannelConfig = (
    id: SensorChannelId,
    patch: Partial<SensorParameterConfig>
  ) => {
    setConfigs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const resetChannelConfig = (id: SensorChannelId) => {
    setConfigs((prev) => ({
      ...prev,
      [id]: structuredClone(DEFAULT_SENSOR_CONFIGS[id]),
    }));
  };

  const resetAllConfigs = () => {
    setConfigs(structuredClone(DEFAULT_SENSOR_CONFIGS));
    setCardOrder([...ALL_CHANNEL_IDS]);
  };

  // Compute current raw ADC counts / deci-Hz per channel based on scenario or manual override
  const snapshots = useMemo(() => {
    const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
    const ageMs = scenario === 'stale' ? 4200 : 35;
    const seq = tick % 256;

    // Realistic dynamic ADC / frequency waveforms per scenario
    let simAdcs: Record<SensorChannelId, number> = {
      // ~190.8°F pre-radiator (ADC ~452 with 2470Ω pull-up)
      coolant_pre: Math.round(452 + 14 * Math.sin(elapsedSec / 6)),
      // ~165.0°F post-radiator (ADC ~635 with 2470Ω pull-up)
      coolant_post: Math.round(635 + 12 * Math.sin(elapsedSec / 7.5)),
      // ~53% fuel (40.5Ω sender -> ADC ~159 with 1000Ω pull-up)
      fuel_level: Math.round(159 + 4 * Math.sin(elapsedSec / 9)),
      // ~1500 RPM cruise / 100.0 Hz bring-up baseline (1000 deci-Hz ± 45 deci-Hz)
      engine_rpm: Math.round(1000 + 45 * Math.sin(elapsedSec / 4.2)),
      // ~6.8 PSI carb fuel (1.41V sender -> 0.846V ADC -> ADC ~1050)
      fuel_pressure_low: Math.round(1050 + 18 * Math.sin(elapsedSec / 4)),
      // ~44 PSI oil pressure (1.71V sender -> 1.028V ADC -> ADC ~1276)
      oil_pressure: Math.round(1276 + 45 * Math.sin(elapsedSec / 5)),
      // ~30 PSI EFI reference (1.30V sender -> 0.78V ADC -> ADC ~968)
      fuel_pressure_high: Math.round(968 + 14 * Math.cos(elapsedSec / 4.5)),
    };

    if (scenario === 'warmup') {
      // Sweeps from ~85°F cold start (ADC ~1850) down to ~192°F warm (ADC ~445)
      const progress = (Math.sin(elapsedSec / 10 - Math.PI / 2) + 1) / 2;
      simAdcs.coolant_pre = Math.round(1850 - progress * 1405);
      simAdcs.coolant_post = Math.round(1920 - progress * 1290);
      simAdcs.engine_rpm = Math.round(733 - progress * 280); // High fast-idle ~1100 RPM down to ~680 RPM warm idle
      simAdcs.oil_pressure = Math.round(1620 - progress * 350);
    } else if (scenario === 'hot_climb') {
      // High thermal load: ~214°F pre-radiator (ADC ~328), ~191°F post-radiator (ADC ~450), ~2950 RPM (196.7 Hz)
      simAdcs.coolant_pre = Math.round(328 + 10 * Math.sin(elapsedSec / 3));
      simAdcs.coolant_post = Math.round(450 + 10 * Math.sin(elapsedSec / 4));
      simAdcs.engine_rpm = Math.round(1967 + 80 * Math.sin(elapsedSec / 2.8));
      simAdcs.oil_pressure = Math.round(1450 + 35 * Math.sin(elapsedSec / 3));
    } else if (scenario === 'fault_injection') {
      simAdcs.coolant_post = 4092; // Open circuit
      simAdcs.fuel_level = 2; // Short circuit
      simAdcs.engine_rpm = 0; // Signal timeout / 0 Hz
    }

    const result = {} as Record<SensorChannelId, ComputedSensorSnapshot>;
    for (const id of ALL_CHANNEL_IDS) {
      const cfg = configs[id];
      const rawAdc = cfg.overrideEnabled ? cfg.overrideAdcRaw : simAdcs[id];
      const forcedMask =
        cfg.overrideStatusMask !== 0
          ? cfg.overrideStatusMask
          : scenario === 'fault_injection' && id === 'coolant_post'
          ? 0x01
          : scenario === 'fault_injection' && id === 'fuel_level'
          ? 0x02
          : scenario === 'fault_injection' && id === 'engine_rpm'
          ? 0x01
          : 0;

      result[id] = evaluateSensorAdc(rawAdc, cfg, tempUnit, {
        sequence: seq,
        ageMs,
        seen: true,
        forcedStatusMask: forcedMask,
      });
    }
    return result;
  }, [configs, tempUnit, scenario, tick]);

  // Append rolling history & raw CAN frames on each tick
  useEffect(() => {
    if (scenario === 'stale') return;

    const uptimeUs = Math.round(
      (3572000 + (Date.now() - startTimeRef.current)) * 1000
    );
    const seq = tick % 256;

    // Update histories
    for (const id of ALL_CHANNEL_IDS) {
      const snap = snapshots[id];
      const arr = historiesRef.current[id];
      arr.push(snap.valid ? snap.reportedValue : null);
      if (arr.length > 80) arr.shift();
    }

    // Add frame to rolling CAN bus buffer
    const activeChannels = ALL_CHANNEL_IDS.filter((id) => configs[id].visible);
    const pickId =
      tick % 5 === 0
        ? 'heartbeat'
        : activeChannels[tick % Math.max(1, activeChannels.length)];

    const nextSeq = ++frameSeqRef.current;

    if (pickId === 'heartbeat' || !pickId) {
      const uptimeMs = Math.floor(uptimeUs / 1000);
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      view.setUint8(0, 1);
      view.setUint8(1, 1);
      view.setUint8(2, 1);
      view.setUint8(3, seq);
      view.setUint32(4, uptimeMs, true);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
      framesRef.current.unshift({
        sequence: nextSeq,
        timestampUs: uptimeUs,
        canId: 0x100,
        canIdHex: '0x100',
        channelName: 'Engine Heartbeat',
        dlc: 8,
        dataHex: hex,
        decodedSummary: `Node 1 Online · Uptime ${formatUptime(
          uptimeMs
        )} · Seq ${seq}`,
        isFault: false,
      });
    } else {
      const cfg = configs[pickId];
      const snap = snapshots[pickId];
      const unit =
        cfg.modelType === 'tx3_ntc' ? `°${tempUnit}` : snap.reportedUnit;
      const decodedSummary =
        cfg.modelType === 'coilx_pulse_rpm'
          ? snap.valid
            ? `Reported: ${Math.round(snap.reportedValue ?? 0)} RPM · Pulse ${snap.pulseHz?.toFixed(
                1
              )} Hz · Period ${snap.pulsePeriodMs?.toFixed(2)} ms`
            : `FAULT (${snap.statusText}) · Pulse ${(snap.pulseHz ?? 0).toFixed(
                1
              )} Hz · 757 A1 ${snap.vAdc.toFixed(2)} V`
          : snap.valid
          ? `Reported: ${snap.reportedValue?.toFixed(1)} ${unit} · Pin ${snap.vAdc.toFixed(
              3
            )} V · ADC ${snap.adcRaw}`
          : `FAULT (${snap.statusText}) · Pin ${snap.vAdc.toFixed(3)} V · ADC ${
              snap.adcRaw
            }`;
      framesRef.current.unshift({
        sequence: nextSeq,
        timestampUs: uptimeUs,
        canId: cfg.canId,
        canIdHex: cfg.canIdHex,
        channelName: cfg.shortName,
        dlc: 8,
        dataHex: snap.canPayloadHex,
        decodedSummary,
        isFault: !snap.valid,
      });
    }

    if (framesRef.current.length > 64) {
      framesRef.current.length = 64;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Export CSV of current telemetry & raw CAN frames
  const handleExportCsv = () => {
    const lines = [
      'timestamp_us,sequence,can_id,channel,raw_adc_or_deci_hz,v_adc_volts,v_sender_volts,resistance_ohms_or_period_ms,reported_value,unit,status,payload_hex',
    ];
    for (const id of ALL_CHANNEL_IDS) {
      const cfg = configs[id];
      const snap = snapshots[id];
      const unit =
        cfg.modelType === 'tx3_ntc' ? `deg_${tempUnit}` : snap.reportedUnit;
      const secondaryRaw =
        cfg.modelType === 'coilx_pulse_rpm'
          ? snap.pulsePeriodMs !== null
            ? snap.pulsePeriodMs.toFixed(3)
            : ''
          : snap.resistanceOhms !== null
          ? snap.resistanceOhms.toFixed(2)
          : '';
      lines.push(
        [
          snap.timestampMs * 1000,
          snap.sequence,
          cfg.canIdHex,
          `"${cfg.name}"`,
          snap.adcRaw,
          snap.vAdc.toFixed(4),
          snap.vSender.toFixed(4),
          secondaryRaw,
          snap.reportedValue !== null ? snap.reportedValue.toFixed(2) : '',
          unit,
          `"${snap.statusText}"`,
          `"${snap.canPayloadHex}"`,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `van-can-telemetry-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleChannelIds = cardOrder.filter((id) => configs[id].visible);
  const hiddenChannelIds = cardOrder.filter((id) => !configs[id].visible);

  const moveCardInOrder = (id: SensorChannelId, dir: -1 | 1) => {
    const visIdx = visibleChannelIds.indexOf(id);
    const targetVisIdx = visIdx + dir;
    if (visIdx < 0 || targetVisIdx < 0 || targetVisIdx >= visibleChannelIds.length)
      return;
    const swapTargetId = visibleChannelIds[targetVisIdx];
    const nextOrder = [...cardOrder];
    const idxA = nextOrder.indexOf(id);
    const idxB = nextOrder.indexOf(swapTargetId);
    [nextOrder[idxA], nextOrder[idxB]] = [nextOrder[idxB], nextOrder[idxA]];
    setCardOrder(nextOrder);
  };

  // Calculate live Radiator Thermal Drop (ΔT = Pre-Radiator - Post-Radiator)
  const preSnap = snapshots.coolant_pre;
  const postSnap = snapshots.coolant_post;
  const radiatorDeltaT =
    preSnap.valid &&
    postSnap.valid &&
    preSnap.reportedValue !== null &&
    postSnap.reportedValue !== null
      ? preSnap.reportedValue - postSnap.reportedValue
      : null;
  const radiatorDeltaV = preSnap.vAdc - postSnap.vAdc;

  const uptimeMs = 3572000 + (Date.now() - startTimeRef.current);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070A0F] dark:text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1017]">
        <div className="max-w-[1380px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#dashboard"
            className="text-base font-bold tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            VAN / CAN
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#dashboard"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Telemetry Cards
            </a>
            <a
              href="#calibration"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Calibration & Curves
            </a>
            <a
              href="#raw-can"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Raw CAN & Faults
            </a>
            <a
              href="#hardware-notes"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Hardware Architecture
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <a
              href="/van-canbus-v0.4.0-debug.apk"
              download="van-canbus-v0.4.0-debug.apk"
              className="px-4 py-2 text-xs font-semibold rounded-md bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Download Android APK</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1380px] mx-auto px-6 py-6 space-y-6">
        {/* Direct Android APK Download & Release Strip */}
        <section
          aria-label="Android APK package download"
          className="border border-cyan-500/40 dark:border-cyan-500/30 rounded-lg bg-white dark:bg-[#0D141C] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>com.nayman.vancan</span>
                <span aria-hidden="true">·</span>
                <span>Version 0.4.0 (Build 4 · RPM Ready)</span>
                <span aria-hidden="true">·</span>
                <span>Android 8.0+ (API 26–36) · BTT U2C USB Host</span>
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Native Android APK Ready with Ford 400M RPM (CAN 0x130 · CoilX + Adafruit 757 · D5/PB4 TIM3_CH1)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Includes the rebuilt Split View (Reported Value vs. Raw Pin Voltage, Resistance Ω, 12-bit ADC &amp; 10 µs Period Ticks / Pulse Hz),
                CAN 0x130 RPM card (<code className="font-mono">RPM = (1500000 + ticks/2) / ticks</code>, 4 pulses/rev, 100/200/400 Hz bring-up test presets),
                and on-device Min/Max &amp; calibration parameter editor.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <a
              href="/van-canbus-ui-and-rpm-params.patch"
              download="van-canbus-ui-and-rpm-params.patch"
              className="px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Git format-patch commit directly on top of bafa6f2 (apply with: git am van-canbus-ui-and-rpm-params.patch)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Git Patch (.patch)</span>
            </a>
            <a
              href="/van-canbus-v0.4.0-debug.apk"
              download="van-canbus-v0.4.0-debug.apk"
              className="px-4 py-2 text-xs font-semibold rounded-md bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download APK (v0.4.0)</span>
            </a>
          </div>
        </section>

        {/* Sub-Header Telemetry Ribbon & Source / Mode Selector */}
        <section
          aria-label="System telemetry summary and display source controls"
          className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0D131A] p-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                1982 Ford E-350 · NUCLEO-G0B1RE + Adafruit CAN Pal · Classical CAN
                500 kbit/s
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mt-0.5">
                Engine Telemetry & Signal Calibration Studio
              </h1>
            </div>

            {/* Scenario, Units, Layout & Theme Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Telemetry scenario"
                value={scenario}
                onChange={(e) =>
                  setScenario(e.target.value as SimulationScenario)
                }
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                <option value="live">Scenario: Normal Warm Drive</option>
                <option value="warmup">Scenario: Cold Start Warm-Up</option>
                <option value="hot_climb">Scenario: Heavy Grade Climb</option>
                <option value="fault_injection">
                  Scenario: Sensor Fault Injection
                </option>
                <option value="stale">Scenario: Stale / Bus Offline</option>
              </select>

              {/* Temperature Unit Toggle */}
              <div
                className="flex items-center p-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                role="group"
                aria-label="Temperature units"
              >
                {(['F', 'C'] as TemperatureUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setTempUnit(u)}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                      tempUnit === u
                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    °{u}
                  </button>
                ))}
              </div>

              {/* Layout Editor Toggle */}
              <button
                type="button"
                onClick={() => setIsEditingLayout((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isEditingLayout
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isEditingLayout ? 'Done Layout' : 'Channels & Order'}</span>
              </button>

              {/* Reset All */}
              <button
                type="button"
                onClick={resetAllConfigs}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Reset all sensor min/max bounds and transfer equations to firmware defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>

              {/* Light / Dark Theme Toggle */}
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500"
                aria-label="Toggle color theme"
                title="Toggle light or dark instrument theme"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            </div>
          </div>

          {/* Primary Display Mode Selector: Reported Values vs. Voltages or Underlying Raw Data Sources */}
          <div className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Card Metric View:
              </span>
              <div
                className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                role="group"
                aria-label="Select card primary value vs underlying raw data source"
              >
                {(
                  [
                    {
                      id: 'comparison',
                      label: 'Reported vs. Raw Split',
                    },
                    {
                      id: 'reported',
                      label: 'Reported Engineering Value',
                    },
                    {
                      id: 'v_adc',
                      label: 'ADC Pin Voltage (V)',
                    },
                    {
                      id: 'v_sender',
                      label: 'Sender / 5V Logic (V)',
                    },
                    {
                      id: 'resistance',
                      label: 'Resistance (Ω) / Period (ms)',
                    },
                    {
                      id: 'adc_raw',
                      label: 'Raw ADC / Pulse Freq (Hz)',
                    },
                  ] as { id: PrimaryDisplaySource; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPrimarySource(mode.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      primarySource === mode.id
                        ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary KPI Strip: Radiator ΔT, RPM, Node Uptime */}
            <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-400 dark:text-slate-500">
                  400M RPM:
                </span>{' '}
                <strong className="text-cyan-600 dark:text-cyan-400">
                  {snapshots.engine_rpm.valid &&
                  snapshots.engine_rpm.reportedValue !== null
                    ? `${Math.round(snapshots.engine_rpm.reportedValue)} RPM`
                    : '—'}
                </strong>{' '}
                <span className="text-slate-400">
                  ({(snapshots.engine_rpm.pulseHz ?? 0).toFixed(1)} Hz)
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">
                  Radiator ΔT:
                </span>{' '}
                <strong className="text-cyan-600 dark:text-cyan-400">
                  {radiatorDeltaT !== null
                    ? `−${radiatorDeltaT.toFixed(1)} °${tempUnit}`
                    : '—'}
                </strong>{' '}
                <span className="text-slate-400">
                  ({radiatorDeltaV >= 0 ? '+' : ''}
                  {radiatorDeltaV.toFixed(3)} V)
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">
                  Node 0x100:
                </span>{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatUptime(uptimeMs)}
                </strong>
              </div>
            </div>
          </div>

          {/* Hidden Channels Drawer when editing layout */}
          {isEditingLayout && hiddenChannelIds.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-500">
                Hidden Channels:
              </span>
              {hiddenChannelIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateChannelConfig(id, { visible: true })}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-dashed border-cyan-500 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Show {configs[id].name} ({configs[id].canIdHex})
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Primary Telemetry Sensor Cards Grid */}
        <section
          id="dashboard"
          aria-label="Live sensor telemetry cards"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {visibleChannelIds.map((id, idx) => (
            <SensorCard
              key={id}
              config={configs[id]}
              snapshot={snapshots[id]}
              history={historiesRef.current[id]}
              primarySource={primarySource}
              tempUnit={tempUnit}
              isSelectedForCalibration={selectedCalChannel === id}
              isEditingLayout={isEditingLayout}
              canMoveUp={idx > 0}
              canMoveDown={idx < visibleChannelIds.length - 1}
              onSelectForCalibration={() => {
                setSelectedCalChannel(id);
                document
                  .getElementById('calibration')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              onUpdateConfig={(patch) => updateChannelConfig(id, patch)}
              onResetChannel={() => resetChannelConfig(id)}
              onMoveCard={(dir) => moveCardInOrder(id, dir)}
              onHideCard={() => updateChannelConfig(id, { visible: false })}
            />
          ))}
        </section>

        {/* Asymmetric Split Console: Modify Parameters, Min/Max Thresholds & Inspect Transfer Curves */}
        <div id="calibration">
          <CalibrationConsole
            configs={configs}
            snapshots={snapshots}
            selectedChannelId={selectedCalChannel}
            tempUnit={tempUnit}
            onSelectChannel={setSelectedCalChannel}
            onUpdateConfig={updateChannelConfig}
            onResetChannel={resetChannelConfig}
          />
        </div>

        {/* Raw CAN 2.0A Frame Stream & Channel Fault Injector */}
        <div id="raw-can">
          <RawCanInspector
            frames={framesRef.current}
            configs={configs}
            onUpdateConfig={updateChannelConfig}
          />
        </div>

        {/* Hardware & Sensor Architecture Reference Summary */}
        <section
          id="hardware-notes"
          aria-label="Hardware and electrical conversion summary"
          className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0D131A] p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            STM32G0B1RE Electrical Frontend & Conversion Reference
          </h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                01. TX3 Coolant Thermistors (0x110 / 0x111)
              </h3>
              <p className="mt-1">
                Pre-radiator (<code className="font-mono">PA0 / ADC1_IN0</code>)
                and post-radiator (<code className="font-mono">PA1 / ADC1_IN1</code>
                ) use a nominal <code className="font-mono">2470 Ω</code> pull-up (
                <code className="font-mono">2.00 kΩ + 470 Ω</code>) to{' '}
                <code className="font-mono">3.3 V</code>. Resistance is computed
                via{' '}
                <code className="font-mono">
                  R = R_pullup × ADC / (4095 − ADC)
                </code>{' '}
                and converted with a 3-point Steinhart-Hart fit (
                <code className="font-mono">0°C: 9335 Ω</code>,{' '}
                <code className="font-mono">20°C: 3500 Ω</code>,{' '}
                <code className="font-mono">80°C: 336 Ω</code>).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                02. Isolated FG72A Fuel Sender (0x120)
              </h3>
              <p className="mt-1">
                Bench input on <code className="font-mono">PB12 / ADC1_IN16</code>{' '}
                with a <code className="font-mono">1000 Ω</code> pull-up to{' '}
                <code className="font-mono">3.3 V</code> and{' '}
                <code className="font-mono">1 kΩ / 100 nF</code> filter. CAN frame
                reports raw ADC count and resistance in{' '}
                <code className="font-mono">0.1 Ω</code> units (valid range{' '}
                <code className="font-mono">5.0–100.0 Ω</code>). Percentage is
                interpolated between <code className="font-mono">75 Ω (0%)</code>{' '}
                and <code className="font-mono">10 Ω (100%)</code>.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                03. Buffered 3-Wire Pressure Inputs (0x140–0x142)
              </h3>
              <p className="mt-1">
                Three-wire GlowShift and MaxTow senders share their gauge signal
                through a <code className="font-mono">100 kΩ / 150 kΩ</code>{' '}
                divider (<code className="font-mono">0.600×</code> gain,{' '}
                <code className="font-mono">250 kΩ</code> load) and{' '}
                <code className="font-mono">MCP6004</code> buffer. Sender voltage
                is reconstructed via{' '}
                <code className="font-mono">V_sender = V_adc / 0.600</code> before
                applying each channel&apos;s zero offset and linear slope.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                04. Ford 400M RPM Input (0x130 · CoilX + 757 · D5/PB4)
              </h3>
              <p className="mt-1">
                Coil primary negative feeds an Autosport Labs{' '}
                <code className="font-mono">CoilX</code> (5 V supply) entering{' '}
                <code className="font-mono">C2.4</code> (signal) and{' '}
                <code className="font-mono">C2.9</code> (data ground). On the
                EPLZON board (<code className="font-mono">E5–E10 / G5–G10</code>,
                underside ground jumper <code className="font-mono">D10–H10</code>
                ), an Adafruit <code className="font-mono">757 BSS138</code> shifts{' '}
                <code className="font-mono">B1 (5 V)</code> to{' '}
                <code className="font-mono">A1 (3.3 V) → Nucleo D5 / PB4 (TIM3_CH1)</code>.
                Captured at <code className="font-mono">100 kHz (10 µs/tick)</code>,
                transmitted on <code className="font-mono">CAN 0x130</code> every{' '}
                <code className="font-mono">100 ms</code>, and mirrored over{' '}
                <code className="font-mono">PA2 / USART2 (115200)</code> ST-Link VCP.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-[1380px] mx-auto px-6 py-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>
          1982 Ford E-350 Van CAN Bus Telemetry · Read-only engine monitoring
        </span>
        <span>
          Parameters & layout saved locally · Export CSV or STM32 C defines above
        </span>
      </footer>
    </div>
  );
}

export default App;
