import React, { useState } from 'react';
import {
  CanFrameRecord,
  SensorChannelId,
  SensorParameterConfig,
} from '../types/telemetry';
import { Pause, Play, AlertTriangle, Terminal } from 'lucide-react';

interface RawCanInspectorProps {
  frames: CanFrameRecord[];
  configs: Record<SensorChannelId, SensorParameterConfig>;
  onUpdateConfig: (
    id: SensorChannelId,
    patch: Partial<SensorParameterConfig>
  ) => void;
}

type FrameFilter = 'all' | 'coolant' | 'fuel' | 'rpm' | 'pressure' | 'heartbeat';

export const RawCanInspector: React.FC<RawCanInspectorProps> = ({
  frames,
  configs,
  onUpdateConfig,
}) => {
  const [filter, setFilter] = useState<FrameFilter>('all');
  const [frozen, setFrozen] = useState(false);
  const [frozenFrames, setFrozenFrames] = useState<CanFrameRecord[]>([]);

  const activeFrames = frozen ? frozenFrames : frames;

  const filteredFrames = activeFrames.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'heartbeat') return f.canId === 0x100;
    if (filter === 'coolant') return f.canId === 0x110 || f.canId === 0x111;
    if (filter === 'fuel') return f.canId === 0x120;
    if (filter === 'rpm') return f.canId === 0x130;
    if (filter === 'pressure')
      return f.canId === 0x140 || f.canId === 0x141 || f.canId === 0x142;
    return true;
  });

  const handleToggleFreeze = () => {
    if (!frozen) {
      setFrozenFrames([...frames]);
      setFrozen(true);
    } else {
      setFrozen(false);
    }
  };

  return (
    <section
      aria-label="Raw CAN frames and fault injection matrix"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5"
    >
      {/* Left: On-the-Wire Classical CAN 500 kbit/s Stream (8 cols) */}
      <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0D131A] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#101720]">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                On the Wire · Classical CAN 2.0A (500 kbit/s) &amp; ST-Link VCP Mirror
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {frozen
                ? 'Frame table frozen for inspection · telemetry & CSV recording continue'
                : 'Live 8-byte little-endian frames · newest first (0x130 RPM also mirrored on PA2/USART2 @ 115200)'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter CAN frames"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FrameFilter)}
              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Messages</option>
              <option value="coolant">Coolant (0x110 / 0x111)</option>
              <option value="fuel">Fuel Level (0x120)</option>
              <option value="rpm">Engine RPM (0x130)</option>
              <option value="pressure">Pressure (0x140–0x142)</option>
              <option value="heartbeat">Heartbeat (0x100)</option>
            </select>

            <button
              type="button"
              onClick={handleToggleFreeze}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                frozen
                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500'
              }`}
            >
              {frozen ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume View</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Freeze View</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0">
                <th className="py-2.5 px-4">Time (s)</th>
                <th className="py-2.5 px-4">CAN ID</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">8-Byte Payload (LE)</th>
                <th className="py-2.5 px-4">Decoded Raw &amp; Engineering</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
              {filteredFrames.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No matching CAN frames in buffer.
                  </td>
                </tr>
              ) : (
                filteredFrames.map((f, idx) => (
                  <tr
                    key={`${f.sequence}-${f.canId}-${idx}`}
                    className={
                      f.isFault
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }
                  >
                    <td className="py-2 px-4 text-slate-500 dark:text-slate-400">
                      {(f.timestampUs / 1_000_000).toFixed(3)}s
                    </td>
                    <td className="py-2 px-4 font-semibold text-cyan-600 dark:text-cyan-400">
                      {f.canIdHex}
                    </td>
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                      {f.channelName}
                    </td>
                    <td className="py-2 px-4 tracking-wider text-slate-900 dark:text-slate-100">
                      {f.dataHex}
                    </td>
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                      {f.decodedSummary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Channel Fault Status & Pin Short/Open Injector (4 cols) */}
      <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0D131A] overflow-hidden flex flex-col justify-between">
        <div>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#101720]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Channel Fault &amp; Boundary Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Force status flags (Byte 2) or jump to ADC / timer period thresholds
            </p>
          </div>

          <div className="p-4 space-y-3">
            {(Object.keys(configs) as SensorChannelId[]).map((id) => {
              const cfg = configs[id];
              return (
                <div
                  key={id}
                  className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {cfg.shortName}{' '}
                      <span className="font-mono text-slate-500">
                        ({cfg.canIdHex})
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {cfg.modelType === 'coilx_pulse_rpm'
                        ? `150–49999 ticks (10 µs) · ${cfg.pulsesPerRev} PPR`
                        : `Short ≤${cfg.adcShortThreshold} · Open ≥${cfg.adcOpenThreshold}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Fault state for ${cfg.name}`}
                      value={cfg.overrideStatusMask}
                      onChange={(e) =>
                        onUpdateConfig(id, {
                          overrideStatusMask: parseInt(e.target.value, 10),
                        })
                      }
                      className="px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      <option value={0}>0x00 VALID</option>
                      <option value={1}>
                        0x01{' '}
                        {cfg.modelType === 'coilx_pulse_rpm'
                          ? 'NO PULSES'
                          : 'Open Circuit'}
                      </option>
                      <option value={2}>
                        0x02{' '}
                        {cfg.modelType === 'coilx_pulse_rpm'
                          ? 'ACQUIRING'
                          : 'Short Circuit'}
                      </option>
                      <option value={4}>
                        0x04{' '}
                        {cfg.modelType === 'coilx_pulse_rpm'
                          ? 'OUT OF RANGE'
                          : 'ADC Error'}
                      </option>
                      <option value={8}>
                        0x08{' '}
                        {cfg.modelType === 'coilx_pulse_rpm'
                          ? 'CAPTURE OVERRUN'
                          : cfg.modelType === 'tx3_ntc'
                          ? 'Calc Error'
                          : 'Out of Range'}
                      </option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Protocol v1: Byte 0 = Version (1), Byte 1 = Node/Sensor ID, Byte 2 = Status,
          Byte 3 = Sequence, Bytes 4–5 = Raw (12-bit ADC / 10 µs Period Ticks LE),
          Bytes 6–7 = Value (0.1°C / 0.1Ω / RPM LE).
        </div>
      </div>
    </section>
  );
};
