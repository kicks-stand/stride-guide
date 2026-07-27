import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_COLUMNS, DEFAULT_ROWS, indexOf, transformCoordinate, type MatrixFrame, type Rotation } from './protocol';
import { simulateFrame, type Scenario } from './simulator';
import './styles.css';

type SerialPortLike = { open(options: { baudRate: number }): Promise<void>; close(): Promise<void>; readable: ReadableStream<Uint8Array> | null; writable: WritableStream<Uint8Array> | null };

declare global { interface Navigator { serial?: { requestPort(): Promise<SerialPortLike> } } }

function colorFor(value: number, max: number): string {
  const t = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const hue = 240 - t * 240;
  return `hsl(${hue} 92% ${22 + t * 36}%)`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const [frame, setFrame] = useState<MatrixFrame>(() => simulateFrame(0, 'two-feet'));
  const [scenario, setScenario] = useState<Scenario>('two-feet');
  const [streaming, setStreaming] = useState(true);
  const [connected, setConnected] = useState(false);
  const [threshold, setThreshold] = useState(40);
  const [scale, setScale] = useState(4095);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (!streaming || connected) return;
    const timer = window.setInterval(() => {
      sequenceRef.current += 1;
      setFrame(simulateFrame(sequenceRef.current, scenario));
    }, 100);
    return () => window.clearInterval(timer);
  }, [streaming, scenario, connected]);

  const metrics = useMemo(() => {
    const active = frame.values.filter((v) => v >= threshold);
    const rowSums = Array.from({ length: frame.rows }, (_, r) => frame.values.slice(r * frame.columns, (r + 1) * frame.columns).reduce((a, b) => a + b, 0));
    const columnSums = Array.from({ length: frame.columns }, (_, c) => frame.values.reduce((sum, v, i) => sum + (i % frame.columns === c ? v : 0), 0));
    return {
      active: active.length,
      mean: active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0,
      deadRows: rowSums.filter((v) => v === 0).length,
      deadColumns: columnSums.filter((v) => v === 0).length,
      saturated: frame.values.filter((v) => v >= 4090).length,
    };
  }, [frame, threshold]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(760, canvas.parentElement?.clientWidth ?? 760);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#07111d';
    ctx.fillRect(0, 0, size, size);
    const cellW = size / frame.columns;
    const cellH = size / frame.rows;
    frame.values.forEach((raw, i) => {
      const row = Math.floor(i / frame.columns);
      const column = i % frame.columns;
      const [tr, tc] = transformCoordinate(row, column, frame.rows, frame.columns, rotation, mirrorX, mirrorY);
      const value = raw >= threshold ? raw : 0;
      ctx.fillStyle = colorFor(value, scale);
      ctx.fillRect(tc * cellW + 0.5, tr * cellH + 0.5, cellW - 1, cellH - 1);
    });
  }, [frame, threshold, scale, rotation, mirrorX, mirrorY]);

  async function connectSerial() {
    if (!navigator.serial) { alert('Web Serial is unavailable. Use Chrome or Edge on desktop, or simulation mode.'); return; }
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 921600 });
    portRef.current = port;
    setConnected(true);
    setStreaming(true);
    const reader = port.readable?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          try {
            const candidate = JSON.parse(line) as MatrixFrame;
            if (candidate.type === 'matrix_frame' && candidate.rows * candidate.columns === candidate.values.length) setFrame(candidate);
          } catch { /* malformed frames are ignored */ }
        }
      }
    } finally { reader.releaseLock(); setConnected(false); }
  }

  async function disconnect() {
    await portRef.current?.close();
    portRef.current = null;
    setConnected(false);
  }

  function inspect(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const c = Math.min(frame.columns - 1, Math.floor(((event.clientX - rect.left) / rect.width) * frame.columns));
    const r = Math.min(frame.rows - 1, Math.floor(((event.clientY - rect.top) / rect.height) * frame.rows));
    setSelected([r, c]);
  }

  return <main className="shell">
    <header><div><div className="eyebrow">STRIDE GUIDE</div><h1>Pressure Platform Diagnostics</h1></div><div className={`status ${connected ? 'online' : ''}`}>{connected ? 'ESP32 connected' : 'Simulation mode'}</div></header>
    <section className="metrics">
      <article><span>Matrix</span><strong>{frame.rows} × {frame.columns}</strong><small>{frame.values.length} contacts</small></article>
      <article><span>Frame rate</span><strong>{Math.round(1000 / Math.max(1, frame.scanDurationMs))} FPS</strong><small>{frame.scanDurationMs} ms scan</small></article>
      <article><span>Active cells</span><strong>{metrics.active}</strong><small>threshold ≥ {threshold}</small></article>
      <article><span>Peak signal</span><strong>{frame.maximum}</strong><small>relative sensor units</small></article>
      <article><span>Fault flags</span><strong>{metrics.deadRows + metrics.deadColumns + metrics.saturated}</strong><small>{metrics.deadRows} rows · {metrics.deadColumns} columns</small></article>
    </section>
    <section className="workspace">
      <div className="mapPanel"><canvas ref={canvasRef} onClick={inspect} aria-label="25 by 25 pressure heatmap" />{selected && <div className="inspector">Cell R{selected[0] + 1} C{selected[1] + 1}: <b>{frame.values[indexOf(selected[0], selected[1], frame.columns)]}</b></div>}</div>
      <aside className="controls">
        <h2>Device</h2><div className="buttonRow"><button onClick={connectSerial} disabled={connected}>Connect USB</button><button className="secondary" onClick={disconnect} disabled={!connected}>Disconnect</button></div>
        <label>Simulation scenario<select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)} disabled={connected}><option value="two-feet">Two feet</option><option value="left-foot">Single foot</option><option value="single">Single contact</option><option value="moving">Moving contact</option><option value="empty">No pressure</option><option value="noise">Electrical noise</option><option value="dead-row">Dead row</option><option value="dead-column">Dead column</option><option value="saturated">Saturated cell</option></select></label>
        <button className="wide" onClick={() => setStreaming((v) => !v)}>{streaming ? 'Stop stream' : 'Start stream'}</button>
        <h2>Signal</h2><label>Activation threshold <output>{threshold}</output><input type="range" min="0" max="1000" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label><label>Display maximum <output>{scale}</output><input type="range" min="250" max="4095" value={scale} onChange={(e) => setScale(Number(e.target.value))} /></label>
        <h2>Orientation</h2><label>Rotation<select value={rotation} onChange={(e) => setRotation(Number(e.target.value) as Rotation)}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label className="check"><input type="checkbox" checked={mirrorX} onChange={(e) => setMirrorX(e.target.checked)} /> Mirror horizontally</label><label className="check"><input type="checkbox" checked={mirrorY} onChange={(e) => setMirrorY(e.target.checked)} /> Mirror vertically</label>
        <h2>Live diagnostics</h2><dl><div><dt>Sequence</dt><dd>{frame.sequence}</dd></div><div><dt>Mean active</dt><dd>{metrics.mean}</dd></div><div><dt>Saturated cells</dt><dd>{metrics.saturated}</dd></div><div><dt>Protocol</dt><dd>v{frame.protocolVersion}</dd></div></dl>
      </aside>
    </section>
    <footer>Development instrument · Relative pressure visualization only · Not a medical diagnostic device</footer>
  </main>;
}
