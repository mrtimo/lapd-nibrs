// LA Crime Map: Plotly views over the queries in crime_map.malloy.
// Every chart is fed by useQuery(..., givens), so all of them follow the same
// nine filters. Clicking an offense bar or an area bar sets that filter.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import { Controls, Given, MultiSelect, filters, useGiven, useQuery, useUrlState } from "@malloyyo/dashboard";

const ACCENT = "#2563eb";
const SEQ = [[0, "#fde68a"], [0.35, "#f97316"], [0.7, "#dc2626"], [1, "#7f1d1d"]];
const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString());
const isDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

// ---- Plotly wrapper ---------------------------------------------------------
function Plot({ data, layout, height = 320, onClick, scrollZoom = false }) {
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
    }, { responsive: true, displaylogo: false, scrollZoom, // page scroll must not zoom the map
      modeBarButtonsToRemove: ["select2d", "lasso2d"] });
    el.removeAllListeners?.("plotly_click");
    if (onClick) el.on("plotly_click", (e) => onClick(e.points[0]));
  }, [data, layout, height, onClick, scrollZoom]);
  useEffect(() => () => ref.current && Plotly.purge(ref.current), []);
  return <div ref={ref} style={{ width: "100%", minHeight: height }} />;
}

function Card({ title, note, children, span = 1, rows = 1 }) {
  return (
    <section className="lc-card" style={{ gridColumn: `span ${span}`, gridRow: `span ${rows}` }}>
      <header>
        <h3>{title}</h3>
        {note && <span className="lc-note">{note}</span>}
      </header>
      {children}
    </section>
  );
}

function Status({ q, children }) {
  if (q.error) return <div className="lc-msg lc-err">{String(q.error.message ?? q.error)}</div>;
  if (q.loading && !q.rows?.length) return <div className="lc-msg">Loading…</div>;
  if (!q.rows?.length) return <div className="lc-msg">No matching records.</div>;
  return children;
}

// ---- Month range slider (sets the PERIOD filter<date> given) ----------------
const monthLabel = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const nextMonth = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

function MonthSlider({ months }) {
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
        <strong>{a === b ? monthLabel(months[a]) : `${monthLabel(months[a])} – ${monthLabel(months[b])}`}</strong>
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

// ---- The dashboard ----------------------------------------------------------
export default function Dashboard({ dashboard, givens }) {
  const kpi = useQuery({ query: "crime_map", givens });
  const vt = useQuery({ query: "victim_totals", givens });
  const points = useQuery({ query: "map_points", givens });
  const monthly = useQuery({ query: "offenses_by_month", givens });
  const top = useQuery({ query: "top_offenses", givens });
  const heat = useQuery({ query: "hour_by_weekday", givens });
  const areas = useQuery({ query: "offenses_by_area", givens });
  const bySex = useQuery({ query: "victims_by_sex", givens });
  const byDescent = useQuery({ query: "victims_by_descent", givens });
  const byAge = useQuery({ query: "victims_by_age", givens });
  const byType = useQuery({ query: "victims_by_type", givens });
  const monthList = useQuery({ query: "month_list", givens: {} });

  const offense = useGiven("OFFENSE");
  const area = useGiven("AREA");
  const [view, setView] = useUrlState("view", "heat");
  const dark = isDark();

  const months = useMemo(
    () => (monthList.rows || []).map((r) => String(r.occurred_month).slice(0, 10)),
    [monthList.rows],
  );

  const k = kpi.rows?.[0] || {};
  const v = vt.rows?.[0] || {};

  // Map ----------------------------------------------------------------------
  const pts = useMemo(() => points.rows?.[0]?.points || [], [points.rows]);
  const mapData = useMemo(() => {
    const r = pts;
    const lat = r.map((d) => d.lat), lon = r.map((d) => d.lon), z = r.map((d) => d.offense_count);
    const text = r.map((d) => `<b>${d.location_label}</b><br>${d.area_label}<br>${fmt(d.offense_count)} offenses`);
    if (view === "heat") {
      return [{ type: "densitymap", lat, lon, z: z.map((n) => Math.sqrt(n)), radius: 10, colorscale: SEQ, showscale: false,
        hoverinfo: "skip" }];
    }
    const max = Math.max(1, ...z);
    return [{ type: "scattermap", mode: "markers", lat, lon, text, hoverinfo: "text",
      // log colour: a few very busy blocks would otherwise wash every other point out
      marker: { size: z.map((n) => 2.5 + 14 * Math.sqrt(n / max)), color: z.map((n) => Math.log10(n)), colorscale: SEQ,
        cmin: 0, cmax: Math.log10(max), opacity: 0.6, showscale: false } }];
  }, [pts, view]);
  const mapLayout = useMemo(() => ({
    map: { style: dark ? "carto-darkmatter" : "carto-positron", center: { lat: 34.03, lon: -118.38 }, zoom: 9 },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    uirevision: "keep-zoom", // filter changes don't reset the user's pan/zoom
  }), [dark]);

  // Charts -------------------------------------------------------------------
  const hbar = (rows, label, value, color = ACCENT) => {
    const r = [...(rows || [])].reverse();
    return [{ type: "bar", orientation: "h", y: r.map((d) => d[label]), x: r.map((d) => d[value]),
      marker: { color }, hovertemplate: "%{y}: %{x:,}<extra></extra>" }];
  };
  const hbarLayout = (n) => ({ margin: { l: 210, r: 16, t: 4, b: 28 }, xaxis: { gridcolor: "rgba(128,128,128,.2)" },
    yaxis: { automargin: true }, bargap: 0.25, height: Math.max(180, 22 * n + 40) });

  const monthlyData = useMemo(() => [{
    type: "scatter", mode: "lines", fill: "tozeroy", line: { color: ACCENT, width: 2 },
    x: (monthly.rows || []).map((d) => String(d.occurred_month).slice(0, 10)),
    y: (monthly.rows || []).map((d) => d.offense_count),
    hovertemplate: "%{x|%b %Y}: %{y:,}<extra></extra>",
  }], [monthly.rows]);

  const heatData = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const z = days.map(() => Array(24).fill(0));
    for (const d of heat.rows || []) z[d.day_of_week_number - 1][d.hour_of_day] = d.offense_count;
    return [{ type: "heatmap", z, x: [...Array(24).keys()], y: days.map((d) => d.slice(0, 3)), colorscale: SEQ,
      hovertemplate: "%{y} %{x}:00 — %{z:,} offenses<extra></extra>", showscale: false }];
  }, [heat.rows]);

  const sexData = useMemo(() => [{
    type: "pie", hole: 0.55, labels: (bySex.rows || []).map((d) => d.victim_sex),
    values: (bySex.rows || []).map((d) => d.victim_count), sort: false, textinfo: "percent", textposition: "inside",
    marker: { colors: ["#2563eb", "#db2777", "#94a3b8", "#a855f7", "#14b8a6", "#f59e0b", "#64748b"] },
    hovertemplate: "%{label}: %{value:,}<extra></extra>",
  }], [bySex.rows]);

  const filtersOn = Object.values(givens || {}).some((x) => x);

  return (
    <div className="lc">
      <style>{CSS}</style>
      <header className="lc-head">
        <div>
          <h1>{dashboard?.title || "LA Crime Map"}</h1>
          <p>Where crime is happening in Los Angeles: LAPD NIBRS offenses and victims, refreshed on the 1st, 10th and 21st of each month.</p>
        </div>
      </header>

      <div className="lc-filters">
        <div className="lc-group">
          <h4>Crime</h4>
          <Controls>
            <Given name="CRIME_AGAINST" />
            <Given name="OFFENSE" />
            <Given name="AREA" />
          </Controls>
        </div>
        <div className="lc-group">
          <h4>Victim</h4>
          <Controls>
            <Given name="VICTIM_TYPE" />
            <Given name="VICTIM_SEX" />
            <Given name="VICTIM_DESCENT" />
            <Given name="VICTIM_AGE" />
          </Controls>
        </div>
        <div className="lc-group lc-when">
          <h4>When</h4>
          {months.length > 1 ? <MonthSlider months={months} /> : <div className="lc-msg">Loading months…</div>}
          <Controls>
            <MultiSelect given="WEEKDAYS" />
          </Controls>
        </div>
      </div>

      <div className="lc-kpis">
        {[
          ["Offenses", fmt(k.offense_count)],
          ["Incidents", fmt(k.case_count)],
          ["Victims", fmt(v.victim_count)],
          ["Shootings", fmt(k.shooting_count)],
          ["Cleared by arrest", k.arrest_rate == null ? "–" : `${(k.arrest_rate * 100).toFixed(1)}%`],
          ["Avg victim age", v.average_age == null ? "–" : v.average_age.toFixed(1)],
        ].map(([label, value]) => (
          <div key={label} className="lc-kpi"><span>{label}</span><strong>{kpi.loading ? "…" : value}</strong></div>
        ))}
      </div>

      <div className="lc-grid">
        <Card span={2} rows={2} title="Where offenses happen" note={
          <span className="lc-toggle">
            {["heat", "points"].map((m) => (
              <button key={m} className={view === m ? "on" : ""} onClick={() => setView(m)}>
                {m === "heat" ? "Heatmap" : "Hundred blocks"}
              </button>
            ))}
          </span>
        }>
          <p className="lc-foot">Zoom with the +/− buttons or double-click. {fmt(pts.length)} hundred-block locations. Offenses without a location are left off the map.</p>
          <Status q={points}><Plot data={mapData} layout={mapLayout} height={820} /></Status>

        </Card>

        <Card title="Top offenses" note={offense.value ? <button className="lc-link" onClick={() => offense.set("")}>Clear offense</button> : "click a bar to filter"}>
          <Status q={top}>
            <Plot data={hbar(top.rows, "offense", "offense_count")} layout={hbarLayout(top.rows?.length || 0)}
              height={Math.max(180, 22 * (top.rows?.length || 0) + 40)}
              onClick={(p) => offense.set(filters.oneOf(p.y))} />
          </Status>
        </Card>

        <Card title="Offenses by LAPD area" note={area.value ? <button className="lc-link" onClick={() => area.set("")}>Clear area</button> : "click a bar to filter"}>
          <Status q={areas}>
            <Plot data={hbar(areas.rows, "area_name", "offense_count", "#0d9488")} layout={{ ...hbarLayout(areas.rows?.length || 0), margin: { l: 110, r: 16, t: 4, b: 28 } }}
              height={Math.max(180, 22 * (areas.rows?.length || 0) + 40)}
              onClick={(p) => area.set(filters.oneOf(p.y))} />
          </Status>
        </Card>

        <Card title="Offenses by month" note="since NIBRS reporting began in 2024">
          <Status q={monthly}>
            <Plot data={monthlyData} height={260} layout={{ margin: { l: 48, r: 12, t: 8, b: 32 },
              xaxis: { type: "date", tickformat: "%b %Y", gridcolor: "rgba(128,128,128,.2)" }, yaxis: { gridcolor: "rgba(128,128,128,.2)" } }} />
          </Status>
        </Card>

        <Card title="Day and hour" note="when offenses occur">
          <Status q={heat}>
            <Plot data={heatData} height={260} layout={{ margin: { l: 40, r: 8, t: 8, b: 48 },
              xaxis: { dtick: 3, title: { text: "Hour of day", standoff: 8 } }, yaxis: { autorange: "reversed" } }} />
          </Status>
        </Card>

        <Card title="Victims by sex">
          <Status q={bySex}><Plot data={sexData} height={260} layout={{ showlegend: true, legend: { orientation: "v" }, uniformtext: { minsize: 10, mode: "hide" } }} /></Status>
        </Card>
        <Card title="Victims by age">
          <Status q={byAge}>
            <Plot height={260} data={[{ type: "bar", x: (byAge.rows || []).map((d) => d.age_group), y: (byAge.rows || []).map((d) => d.victim_count),
              marker: { color: "#7c3aed" }, hovertemplate: "%{x}: %{y:,}<extra></extra>" }]}
              layout={{ margin: { l: 48, r: 8, t: 8, b: 8 }, xaxis: { automargin: true, tickangle: -30 }, yaxis: { gridcolor: "rgba(128,128,128,.2)" } }} />
          </Status>
        </Card>
        <Card title="Victims by descent">
          <Status q={byDescent}>
            <Plot data={hbar(byDescent.rows, "victim_descent", "victim_count", "#db2777")} layout={{ ...hbarLayout(byDescent.rows?.length || 0), margin: { l: 140, r: 16, t: 4, b: 28 } }}
              height={Math.max(180, 22 * (byDescent.rows?.length || 0) + 40)} />
          </Status>
        </Card>
        <Card title="Victims by type">
          <Status q={byType}>
            <Plot data={hbar(byType.rows, "victim_category", "victim_count", "#ea580c")} layout={{ ...hbarLayout(byType.rows?.length || 0), margin: { l: 170, r: 16, t: 4, b: 28 } }}
              height={Math.max(180, 22 * (byType.rows?.length || 0) + 40)} />
          </Status>
        </Card>
      </div>

      <footer className="lc-footer">
        {filtersOn ? "Filters apply to every chart. " : ""}
        Source: City of Los Angeles open data, LAPD NIBRS Offenses and Victims. Victim filters keep offenses whose incident had a matching victim.
      </footer>
    </div>
  );
}

const CSS = `
.lc { --edge: var(--dash-border, #e4e6eb); --surface: var(--dash-panel-bg, #fff); --muted: var(--dash-muted, #6b7280);
  color: var(--dash-fg, #111827); max-width: 1400px; margin: 0 auto; padding: 16px; font-family: var(--dash-font, system-ui, sans-serif); }
.lc h1 { margin: 0 0 4px; font-size: 26px; }
.lc-head p { margin: 0 0 16px; color: var(--muted); }
.lc-filters { display: grid; grid-template-columns: 1fr 1.3fr 1.2fr; gap: 12px; margin-bottom: 16px; }
.lc-group { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; background: var(--dash-controls-bg, transparent); }
.lc-group h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.lc-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 16px; }
.lc-kpi { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 14px; }
.lc-kpi span { display: block; font-size: 12px; color: var(--muted); }
.lc-kpi strong { font-size: 24px; font-variant-numeric: tabular-nums; }
.lc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.lc-card { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; min-width: 0; }
.lc-card header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.lc-card h3 { margin: 0; font-size: 15px; }
.lc-note, .lc-foot, .lc-footer { font-size: 12px; color: var(--muted); }
.lc-foot { margin: 0 0 8px; }
.lc-footer { margin-top: 16px; }
.lc-msg { padding: 24px; text-align: center; color: var(--muted); }
.lc-err { color: var(--dash-danger, #dc2626); text-align: left; white-space: pre-wrap; }
.lc-link { background: none; border: 0; padding: 0; color: var(--dash-accent, ${ACCENT}); cursor: pointer; font: inherit; font-size: 12px; }
.lc-toggle button { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--edge); background: transparent; color: inherit; cursor: pointer; }
.lc-toggle button:first-child { border-radius: 6px 0 0 6px; } .lc-toggle button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
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
  .lc-filters { grid-template-columns: 1fr; }
  .lc-kpis { grid-template-columns: repeat(3, 1fr); }
  .lc-grid { grid-template-columns: 1fr; }
  .lc-card { grid-column: auto !important; }
}
`;
