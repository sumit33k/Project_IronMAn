'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Wifi, Plus, Trash2, Loader2, Play, Square, Home, Pause,
  Volume2, Zap, Battery, AlertCircle, CheckCircle2, RefreshCw,
  Wind, X, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Robot {
  id: string;
  device_type: 'irobot' | 'roborock';
  name: string;
  ip_address: string | null;
  status: string;
  last_state: Record<string, unknown>;
  last_seen_at: string | null;
  configured: boolean;
}

interface LiveStatus {
  state?: string;
  battery?: number;
  error?: string;
  clean_time_seconds?: number;
  clean_area_m2?: number;
  bin_full?: boolean;
  in_cleaning?: boolean;
  fan_speed?: string;
  timestamp?: string;
}

const STATUS_STYLES: Record<string, string> = {
  cleaning:      'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
  charging:      'text-yellow-400 bg-yellow-950/40 border-yellow-800/50',
  docked:        'text-slate-400 bg-slate-900/40 border-slate-700/50',
  returning_dock:'text-indigo-400 bg-indigo-950/40 border-indigo-800/50',
  stopped:       'text-slate-400 bg-slate-900/40 border-slate-700/50',
  paused:        'text-amber-400 bg-amber-950/40 border-amber-800/50',
  idle:          'text-slate-500 bg-slate-900/40 border-slate-700/50',
  unknown:       'text-slate-600 bg-slate-900/40 border-slate-700/50',
  error:         'text-red-400 bg-red-950/40 border-red-800/50',
  emptying_bin:  'text-purple-400 bg-purple-950/40 border-purple-800/50',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cleaning: Play, charging: Zap, docked: Home, returning_dock: Home,
  stopped: Square, paused: Pause, error: AlertCircle,
};

type Toast = { msg: string; ok: boolean };

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <Battery className="w-3.5 h-3.5 text-slate-500" />
      <div className="w-20 h-1.5 bg-[#1e2847] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400">{pct}%</span>
    </div>
  );
}

export default function RobotsPage() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [commanding, setCommanding] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [scanResult, setScanResult] = useState<{ ip: string; brand: string }[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/robots`);
      setRobots(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const fetchStatus = async (id: string) => {
    setFetching(f => ({ ...f, [id]: true }));
    try {
      const r = await fetch(`${API}/robots/${id}/status`);
      const d = await r.json();
      if (d.live) setLiveStatus(s => ({ ...s, [id]: d.live }));
      setRobots(rs => rs.map(rb => rb.id === id ? { ...rb, status: d.status } : rb));
    } finally {
      setFetching(f => ({ ...f, [id]: false }));
    }
  };

  const sendCommand = async (id: string, cmd: string) => {
    setCommanding(c => ({ ...c, [id]: cmd }));
    try {
      const r = await fetch(`${API}/robots/${id}/${cmd}`, { method: 'POST' });
      const d = await r.json();
      if (d.result?.error) {
        showToast(d.result.error, false);
      } else {
        showToast(`${cmd} sent successfully`, true);
        setRobots(rs => rs.map(rb => rb.id === id ? { ...rb, ...d.robot } : rb));
      }
    } catch {
      showToast('Command failed — check robot connection', false);
    } finally {
      setCommanding(c => ({ ...c, [id]: '' }));
    }
  };

  const deleteRobot = async (id: string) => {
    if (!confirm('Remove this robot?')) return;
    await fetch(`${API}/robots/${id}`, { method: 'DELETE' });
    setRobots(rs => rs.filter(r => r.id !== id));
    showToast('Robot removed', true);
  };

  const scanNetwork = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const r = await fetch(`${API}/robots/scan/network`, { method: 'POST' });
      const d = await r.json();
      setScanResult(d.found || []);
    } finally {
      setScanning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading robots…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={clsx(
              'fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl',
              toast.ok
                ? 'bg-emerald-950/90 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/90 border-red-800/60 text-red-300',
            )}
          >
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Robot Control</h1>
          <p className="text-xs text-slate-500 mt-0.5">iRobot &amp; Roborock — local network</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void scanNetwork()}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131720] border border-[#1e2847] hover:border-indigo-600/60 text-xs text-slate-300 transition-all"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-indigo-400" />}
            Scan Network
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Robot
          </button>
        </div>
      </div>

      {/* Scan results */}
      <AnimatePresence>
        {scanResult !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-5 bg-[#131720] border border-[#1e2847] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Network Scan Results</p>
              <button onClick={() => setScanResult(null)} className="text-slate-600 hover:text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            {scanResult.length === 0 ? (
              <p className="text-xs text-slate-600">No robots found on this network. Make sure they&apos;re on the same WiFi.</p>
            ) : (
              <div className="space-y-2">
                {scanResult.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{d.ip} — <span className="text-indigo-400 capitalize">{d.brand}</span></span>
                    <button
                      onClick={() => { setShowAdd(true); setScanResult(null); }}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Add <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Robot cards */}
      <div className="space-y-4">
        {robots.length === 0 ? (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-slate-400 text-sm mb-1">No robots added yet.</p>
            <p className="text-slate-600 text-xs mb-4">Click &quot;Scan Network&quot; to find robots, or &quot;Add Robot&quot; to enter manually.</p>
            <button onClick={() => setShowAdd(true)} className="text-indigo-400 text-sm hover:underline">Add your first robot →</button>
          </div>
        ) : (
          robots.map(robot => {
            const live = liveStatus[robot.id];
            const StatusIcon = STATUS_ICON[robot.status] ?? Wifi;
            const isBusy = commanding[robot.id];

            return (
              <motion.div
                key={robot.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5"
              >
                {/* Robot header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{robot.device_type === 'irobot' ? '🤖' : '🧹'}</div>
                    <div>
                      <p className="font-semibold text-white">{robot.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{robot.device_type === 'irobot' ? 'iRobot Roomba' : 'Roborock'} · {robot.ip_address || 'IP not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border capitalize', STATUS_STYLES[robot.status] ?? STATUS_STYLES.unknown)}>
                      <StatusIcon className="w-3 h-3" />
                      {robot.status.replace('_', ' ')}
                    </span>
                    <button onClick={() => void fetchStatus(robot.id)} className="text-slate-600 hover:text-slate-400 transition-colors">
                      {fetching[robot.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={() => void deleteRobot(robot.id)} className="text-slate-700 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live stats */}
                {live && !live.error && (
                  <div className="flex flex-wrap gap-4 mb-4 px-1">
                    {live.battery != null && <BatteryBar pct={live.battery} />}
                    {live.clean_area_m2 != null && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="text-slate-600">Area</span> {live.clean_area_m2} m²
                      </span>
                    )}
                    {live.clean_time_seconds != null && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="text-slate-600">Time</span> {Math.round(live.clean_time_seconds / 60)} min
                      </span>
                    )}
                    {live.fan_speed && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Wind className="w-3 h-3 text-slate-600" /> {live.fan_speed}
                      </span>
                    )}
                    {live.bin_full && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">⚠️ Bin full</span>
                    )}
                    {live.error && live.error !== 'none' && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {live.error}
                      </span>
                    )}
                  </div>
                )}

                {live?.error && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/40 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {String(live.error)}
                  </div>
                )}

                {!robot.configured && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300">
                    ⚙️ Configure IP &amp; credentials to enable control
                  </div>
                )}

                {/* Control buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { cmd: 'clean', icon: Play, label: 'Clean', color: 'text-emerald-400', active: 'bg-emerald-900/30 border-emerald-800/50' },
                    { cmd: 'dock',  icon: Home,  label: 'Dock',  color: 'text-indigo-400', active: 'bg-indigo-900/30 border-indigo-800/50' },
                    { cmd: 'pause', icon: Pause, label: 'Pause', color: 'text-amber-400',  active: 'bg-amber-900/30 border-amber-800/50' },
                    { cmd: 'stop',  icon: Square,label: 'Stop',  color: 'text-red-400',    active: 'bg-red-900/20 border-red-900/40' },
                    { cmd: 'find',  icon: Volume2,label: 'Find', color: 'text-sky-400',    active: 'bg-sky-900/30 border-sky-800/50' },
                    ...(robot.device_type === 'roborock' ? [
                      { cmd: 'fan_quiet', icon: Wind, label: 'Quiet',  color: 'text-teal-400', active: 'bg-teal-900/30 border-teal-800/50' },
                      { cmd: 'fan_max',   icon: Wind, label: 'Max',    color: 'text-orange-400', active: 'bg-orange-900/30 border-orange-800/50' },
                    ] : []),
                  ].map(({ cmd, icon: Icon, label, color, active }) => (
                    <button
                      key={cmd}
                      onClick={() => void sendCommand(robot.id, cmd)}
                      disabled={!!isBusy || !robot.configured}
                      className={clsx(
                        'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40',
                        isBusy === cmd
                          ? active
                          : 'bg-[#1a2035] border-[#1e2847] hover:border-slate-600',
                      )}
                    >
                      {isBusy === cmd
                        ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        : <Icon className={`w-4 h-4 ${color}`} />
                      }
                      <span className="text-slate-400">{label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Setup guide */}
      <div className="mt-6 bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Setup Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-white mb-1.5">🤖 iRobot Roomba</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
              <li>Hold HOME button 2 seconds (beeps)</li>
              <li><code className="text-indigo-400">pip install irobotpy</code></li>
              <li><code className="text-indigo-400">python -m irobotpy.password ROBOT_IP</code></li>
              <li>Copy BLID + password → Add Robot form</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-white mb-1.5">🧹 Roborock</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
              <li>Find robot IP in your router&apos;s DHCP table</li>
              <li><code className="text-indigo-400">pip install python-miio</code></li>
              <li><code className="text-indigo-400">miiocli device discover</code> (same WiFi)</li>
              <li>Copy IP + 32-char token → Add Robot form</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Add Robot modal */}
      <AnimatePresence>
        {showAdd && <AddRobotModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); void load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function AddRobotModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<'irobot' | 'roborock'>('roborock');
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [token, setToken] = useState('');
  const [blid, setBlid] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, string> = { device_type: type, name: name || `My ${type}`, ip_address: ip };
    if (type === 'roborock') body.token = token;
    else { body.blid = blid; body.password = password; }

    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/robots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onAdded();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#131720] border border-[#1e2847] rounded-2xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Add Robot</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div className="flex gap-2">
            {(['roborock', 'irobot'] as const).map(t => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                  type === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#1a2035] border-[#1e2847] text-slate-400',
                )}
              >
                {t === 'roborock' ? '🧹 Roborock' : '🤖 iRobot'}
              </button>
            ))}
          </div>

          <Field label="Name" value={name} onChange={setName} placeholder={`My ${type}`} />
          <Field label="IP Address" value={ip} onChange={setIp} placeholder="192.168.1.xxx" />

          {type === 'roborock' ? (
            <Field label="Token (32 hex chars)" value={token} onChange={setToken} placeholder="a1b2c3d4e5f6..." />
          ) : (
            <>
              <Field label="BLID" value={blid} onChange={setBlid} placeholder="from irobotpy.password" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="robot password" type="password" />
            </>
          )}

          <button
            type="submit" disabled={saving || !ip}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Robot
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#0d0f14] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
      />
    </div>
  );
}
