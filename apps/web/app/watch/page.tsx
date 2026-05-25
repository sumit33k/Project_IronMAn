'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface WatchData {
  spoken_summary: string;
  urgent_count: number;
  today_count: number;
  robots: { name: string; status: string }[];
}

const ROBOT_EMOJI: Record<string, string> = {
  cleaning: '🟢', charging: '🔋', docked: '🏠',
  returning_dock: '🔄', paused: '⏸', stopped: '⬛', unknown: '❓', error: '🔴',
};

export default function WatchPage() {
  const [data, setData] = useState<WatchData | null>(null);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const tick = () => {
    const now = new Date();
    setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  };

  useEffect(() => { tick(); const t = setInterval(tick, 1000); return () => clearInterval(t); }, []);

  const load = async () => {
    try {
      const r = await fetch(`${API}/watch/brief`);
      setData(await r.json()); setErr(false);
    } catch { setErr(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  return (
    <div style={{
      background: '#000', color: '#fff',
      fontFamily: '-apple-system, sans-serif',
      width: '184px', minHeight: '224px',
      padding: '12px 10px', margin: '0 auto',
      borderRadius: '24px',
      boxShadow: '0 0 0 3px #222',
    }}>
      {/* Time */}
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1 }}>{time}</div>
      <div style={{ fontSize: 9, color: '#666', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{date}</div>

      <div style={{ height: 1, background: '#222', margin: '10px 0' }} />

      {loading ? (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', paddingTop: 8 }}>Loading…</div>
      ) : err ? (
        <div style={{ color: '#f87171', fontSize: 10, textAlign: 'center', paddingTop: 8 }}>
          API offline<br /><span style={{ color: '#555' }}>Start backend first</span>
        </div>
      ) : data ? (
        <>
          <Row label="Urgent" value={data.urgent_count} urgent={data.urgent_count > 0} />
          <Row label="Today" value={data.today_count} />

          {data.robots.length > 0 && (
            <>
              <div style={{ height: 1, background: '#222', margin: '8px 0' }} />
              {data.robots.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginBottom: 5 }}>
                  <span>{r.name}</span>
                  <span>{ROBOT_EMOJI[r.status] ?? '❓'} {r.status}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ height: 1, background: '#222', margin: '8px 0' }} />

          <Btn href="/today" color="#4f46e5">📋 Today</Btn>
          <Btn href="/focus" color="#059669">⚡ Focus</Btn>
          {data.robots.length > 0 && <Btn href="/robots" color="#dc2626">🤖 Robots</Btn>}
        </>
      ) : null}

      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <button onClick={() => void load()} style={{
          background: 'none', border: '1px solid #333', borderRadius: 6,
          color: '#666', fontSize: 9, padding: '3px 8px', cursor: 'pointer',
        }}>↻</button>
      </div>
    </div>
  );
}

function Row({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <span style={{ fontSize: 10, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: urgent ? '#f87171' : '#fff' }}>{value}</span>
    </div>
  );
}

function Btn({ href, color, children }: { href: string; color: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'block', marginTop: 6, padding: '7px 0',
      background: color, borderRadius: 10,
      color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center',
      textDecoration: 'none',
    }}>
      {children}
    </Link>
  );
}
