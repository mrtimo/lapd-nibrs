// Shared pieces for the Rising Crimes and Crimes x Victims dashboards:
// a Plotly wrapper, cards, loading states, the month range slider, and CSS.
import React, { useEffect, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import { filters, useGiven } from "@malloyyo/dashboard";

export const ACCENT = "#2563eb";
export const UP = "#dc2626"; // more crime
export const DOWN = "#2563eb"; // less crime
export const SEQ = [[0, "#fde68a"], [0.35, "#f97316"], [0.7, "#dc2626"], [1, "#7f1d1d"]];
export const GRID = "rgba(128,128,128,.2)";
export const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString());
export const pctFmt = (x, digits = 0) => (x == null || !Number.isFinite(x) ? "–" : `${(x * 100).toFixed(digits)}%`);
export const signed = (n) => (n == null ? "–" : `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}`);
export const signedPct = (x) => (x == null || !Number.isFinite(x) ? "new" : `${x > 0 ? "+" : ""}${(x * 100).toFixed(0)}%`);
export const isDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

// ---- dates (ISO yyyy-mm-dd, month starts) -----------------------------------
export const iso = (v) => String(v).slice(0, 10);
export const addMonths = (s, n) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
export const nextMonth = (s) => addMonths(s, 1);
export const monthLabel = (s) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const rangeLabel = (a, b) => (a === b ? monthLabel(a) : `${monthLabel(a)} – ${monthLabel(b)}`);

// ---- Plotly wrapper ---------------------------------------------------------
export function Plot({ data, layout, height = 320, onClick, scrollZoom = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fg = getComputedStyle(el).color;
    Plotly.react(el, data, {
      height,
      margin: { l: 8, r: 8, t: 8, b: 8 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: fg, size: 12 },
      ...layout,
    }, { responsive: true, displaylogo: false, scrollZoom, modeBarButtonsToRemove: ["select2d", "lasso2d"] });
    el.removeAllListeners?.("plotly_click");
    if (onClick) el.on("plotly_click", (e) => onClick(e.points[0]));
  }, [data, layout, height, onClick, scrollZoom]);
  useEffect(() => () => ref.current && Plotly.purge(ref.current), []);
  return <div ref={ref} style={{ width: "100%", minHeight: height }} />;
}

export function Card({ title, note, children, span = 1, rows = 1, className = "" }) {
  return (
    <section className={`lc-card ${className}`} style={{ gridColumn: `span ${span}`, gridRow: `span ${rows}` }}>
      <header>
        <h3>{title}</h3>
        {note && <span className="lc-note">{note}</span>}
      </header>
      {children}
    </section>
  );
}

export function Status({ q, children }) {
  if (q.error) return <div className="lc-msg lc-err">{String(q.error.message ?? q.error)}</div>;
  if (q.loading && !q.rows?.length) return <div className="lc-msg">Loading…</div>;
  if (!q.rows?.length) return <div className="lc-msg">No matching records.</div>;
  return children;
}

// Segmented buttons: options = [[value, label], ...]
export function Toggle({ value, options, onChange, label }) {
  return (
    <span className="lc-toggle" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} className={String(value) === String(v) ? "on" : ""} onClick={() => onChange(v)}>{text}</button>
      ))}
    </span>
  );
}

// ---- Month range slider (sets the PERIOD filter<date> given) ----------------
export function MonthSlider({ months }) {
  const period = useGiven("PERIOD");
  const last = months.length - 1;
  const fromValue = () => {
    const m = /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/.exec(period.value || "");
    if (!m) return [0, last];
    const a = months.indexOf(m[1]);
    const b = months.findIndex((x) => nextMonth(x) === m[2]);
    return [a < 0 ? 0 : a, b < 0 ? last : b];
  };
  const [range, setRange] = useState(fromValue);
  useEffect(() => setRange(fromValue()), [period.value, last]);

  const commit = ([a, b]) => {
    const all = a === 0 && b === last;
    period.set(all ? "" : filters.dateRange(months[a], nextMonth(months[b])));
  };
  const move = (i) => (e) => {
    const v = Number(e.target.value);
    setRange(([a, b]) => (i === 0 ? [Math.min(v, b), b] : [a, Math.max(v, a)]));
  };
  const done = () => commit(range);
  const [a, b] = range;
  const pct = (i) => (last ? (i / last) * 100 : 0);
  return (
    <div className="lc-slider">
      <div className="lc-slider-label">
        <span>Months</span>
        <strong>{rangeLabel(months[a], months[b])}</strong>
        {(a !== 0 || b !== last) && (
          <button className="lc-link" onClick={() => { setRange([0, last]); commit([0, last]); }}>All months</button>
        )}
        <button className="lc-link" onClick={() => { setRange([last, last]); commit([last, last]); }}>Latest month</button>
      </div>
      <div className="lc-track">
        <div className="lc-fill" style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }} />
        {[a, b].map((v, i) => (
          <input key={i} type="range" min={0} max={last} step={1} value={v}
            aria-label={i === 0 ? "First month" : "Last month"}
            onChange={move(i)} onPointerUp={done} onKeyUp={done} onTouchEnd={done} />
        ))}
      </div>
      <div className="lc-ticks">
        <span>{monthLabel(months[0])}</span>
        <span>{monthLabel(months[last])}</span>
      </div>
    </div>
  );
}

export const BASE_CSS = `
.lc { --edge: var(--dash-border, #e4e6eb); --muted: var(--dash-muted, #6b7280);
  color: var(--dash-fg, #111827); max-width: 1400px; margin: 0 auto; padding: 16px; font-family: var(--dash-font, system-ui, sans-serif); }
.lc h1 { margin: 0 0 4px; font-size: 26px; }
.lc-head p { margin: 0 0 12px; color: var(--muted); max-width: 900px; }
.lc-filters { display: grid; gap: 12px; margin-bottom: 16px; }
.lc-group { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; background: var(--dash-controls-bg, transparent); min-width: 0; }
.lc-group h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.lc-row { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; font-size: 13px; margin-bottom: 6px; }
.lc-row label { color: var(--muted); }
.lc-row select, .lc-row input { font: inherit; font-size: 13px; padding: 3px 6px; border: 1px solid var(--edge); border-radius: 6px; background: transparent; color: inherit; }
.lc-row select option { color: #111; }
.lc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.lc-kpi { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 14px; }
.lc-kpi span { display: block; font-size: 12px; color: var(--muted); }
.lc-kpi strong { font-size: 24px; font-variant-numeric: tabular-nums; }
.lc-kpi small { display: block; font-size: 12px; color: var(--muted); }
.lc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.lc-card { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; min-width: 0; }
.lc-card header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.lc-card h3 { margin: 0; font-size: 15px; }
.lc-note, .lc-foot, .lc-footer { font-size: 12px; color: var(--muted); }
.lc-foot { margin: 0 0 8px; }
.lc-footer { margin-top: 16px; }
.lc-warn { color: var(--dash-danger, #b45309); }
.lc-msg { padding: 24px; text-align: center; color: var(--muted); }
.lc-err { color: var(--dash-danger, #dc2626); text-align: left; white-space: pre-wrap; }
.lc-link { background: none; border: 0; padding: 0; color: var(--dash-accent, ${ACCENT}); cursor: pointer; font: inherit; font-size: 12px; }
.lc-toggle { display: inline-flex; }
.lc-toggle button { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--edge); border-left-width: 0; background: transparent; color: inherit; cursor: pointer; }
.lc-toggle button:first-child { border-radius: 6px 0 0 6px; border-left-width: 1px; } .lc-toggle button:last-child { border-radius: 0 6px 6px 0; }
.lc-toggle button.on { background: var(--dash-accent, ${ACCENT}); color: var(--dash-accent-fg, #fff); border-color: var(--dash-accent, ${ACCENT}); }
.lc-slider { margin-bottom: 8px; }
.lc-slider-label { display: flex; gap: 10px; align-items: baseline; font-size: 13px; flex-wrap: wrap; }
.lc-slider-label span { color: var(--muted); }
.lc-track { position: relative; height: 28px; }
.lc-track::before { content: ""; position: absolute; left: 0; right: 0; top: 12px; height: 4px; border-radius: 2px; background: var(--edge); }
.lc-fill { position: absolute; top: 12px; height: 4px; border-radius: 2px; background: var(--dash-accent, ${ACCENT}); }
.lc-track input { position: absolute; left: 0; width: 100%; top: 4px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; height: 20px; }
.lc-track input::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--dash-accent, ${ACCENT}); border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35); cursor: grab; }
.lc-track input::-moz-range-thumb { pointer-events: auto; width: 16px; height: 16px; border-radius: 50%; background: var(--dash-accent, ${ACCENT}); border: 2px solid #fff; cursor: grab; }
.lc-track input::-moz-range-track { background: none; }
.lc-ticks { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
@media (max-width: 1000px) {
  .lc-filters { grid-template-columns: 1fr !important; }
  .lc-kpis { grid-template-columns: repeat(2, 1fr); }
  .lc-grid { grid-template-columns: 1fr; }
  .lc-card { grid-column: auto !important; grid-row: auto !important; }
}
`;
