// Rising Crimes: which offenses are increasing the most, and where.
// The comparison controls (window length, baseline, end month) are turned into
// two date filters, RECENT and BEFORE, passed to the queries in
// rising_crimes.malloy. The table, map and charts are computed from one
// offense x area result, so they always agree.
import React, { useMemo, useState } from "react";
import { Controls, Given, MultiSelect, filters, useQuery, useUrlState } from "@malloyyo/dashboard";
import {
  BASE_CSS, Card, DOWN, GRID, Plot, Status, Toggle, UP, addMonths, fmt, iso, isDark,
  monthLabel, nextMonth, rangeLabel, signed, signedPct,
} from "./lib/ui.jsx";

const NIBRS_START = "2024-03-01"; // LAPD began NIBRS reporting in March 2024
const VIEWS = [["pair", "Offense × area"], ["offense", "Offense"], ["area", "Area"]];

const COLUMNS = [
  { key: "offense", label: "Offense", views: ["pair", "offense"], text: true },
  { key: "area", label: "LAPD area", views: ["pair", "area"], text: true },
  { key: "baseline", label: "Baseline", num: true },
  { key: "recent", label: "Recent", num: true },
  { key: "change", label: "Change", num: true },
  { key: "pct", label: "% change", num: true },
];

// Roll offense x area rows up to the chosen view and compute changes.
function rollUp(rows, view) {
  const out = new Map();
  for (const r of rows) {
    const key = view === "pair" ? `${r.offense}|${r.area_name}` : view === "offense" ? r.offense : r.area_name;
    const cur = out.get(key) || {
      key, offense: view === "area" ? null : r.offense, area: view === "offense" ? null : r.area_name, recent: 0, baseline: 0,
    };
    cur.recent += r.recent || 0;
    cur.baseline += r.baseline || 0;
    out.set(key, cur);
  }
  return [...out.values()].map((d) => ({
    ...d,
    change: d.recent - d.baseline,
    pct: d.baseline ? (d.recent - d.baseline) / d.baseline : d.recent ? Infinity : 0,
  }));
}

export default function Dashboard({ dashboard, givens }) {
  const monthsQ = useQuery({ query: "trend_months", givens: {} });
  const centers = useQuery({ query: "area_centers", givens: {} });

  // comparison settings live in the URL so a view can be shared
  const [win, setWin] = useUrlState("win", 3);
  const [base, setBase] = useUrlState("base", "year");
  const [endPick, setEndPick] = useUrlState("end", "");
  const [view, setView] = useUrlState("by", "pair");
  const [minCount, setMinCount] = useUrlState("min", 25);
  const [sort, setSort] = useUrlState("sort", { key: "change", dir: "desc" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // a table row

  // Months with data; the last complete month is the one before the month of
  // the newest report (the current month is still being filled in).
  const { months, lastComplete } = useMemo(() => {
    const rows = monthsQ.rows || [];
    const ms = rows.map((r) => iso(r.occurred_month));
    const lastRpt = rows.reduce((m, r) => (r.last_reported && String(r.last_reported) > m ? String(r.last_reported) : m), "");
    const cutoff = lastRpt ? addMonths(lastRpt.slice(0, 7) + "-01", -1) : ms[ms.length - 1];
    const usable = ms.filter((m) => m <= cutoff);
    return { months: usable, lastComplete: usable[usable.length - 1] };
  }, [monthsQ.rows]);

  const end = months.includes(endPick) ? endPick : lastComplete;
  const n = Number(win) || 3;
  const recentStart = end ? addMonths(end, -(n - 1)) : null;
  const baseStart = end ? addMonths(recentStart, base === "year" ? -12 : -n) : null;
  const baseEnd = end ? addMonths(baseStart, n - 1) : null;
  const ready = !!end;
  const windows = ready ? {
    RECENT: filters.dateRange(recentStart, nextMonth(end)),
    BEFORE: filters.dateRange(baseStart, nextMonth(baseEnd)),
  } : {};
  const tg = { ...givens, ...windows };

  const kpi = useQuery({ query: "rising_crimes", givens: tg, skip: !ready });
  const grid = useQuery({ query: "trend_by_offense_area", givens: tg, skip: !ready });

  const baseRows = grid.rows || [];
  const all = useMemo(() => rollUp(baseRows, view), [baseRows, view]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = Number(minCount) || 0;
    const rows = all.filter((d) => Math.max(d.recent, d.baseline) >= min
      && (!q || `${d.offense || ""} ${d.area || ""}`.toLowerCase().includes(q)));
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const x = a[key], y = b[key];
      if (typeof x === "string" || typeof y === "string") return mul * String(x ?? "").localeCompare(String(y ?? ""));
      return mul * ((x ?? -Infinity) - (y ?? -Infinity)) || b.recent - a.recent;
    });
  }, [all, minCount, search, sort]);

  const onSort = (key) => setSort(sort.key === key
    ? { key, dir: sort.dir === "desc" ? "asc" : "desc" }
    : { key, dir: COLUMNS.find((c) => c.key === key)?.text ? "asc" : "desc" });

  // the selected row narrows the history chart and the map
  const sel = selected && shown.find((d) => d.key === selected.key) ? selected : null;
  const histGivens = {
    ...givens,
    ...(sel?.offense ? { OFFENSE: filters.oneOf(sel.offense) } : {}),
    ...(sel?.area ? { AREA: filters.oneOf(sel.area) } : {}),
  };
  const history = useQuery({ query: "trend_monthly", givens: histGivens });

  const rising = shown.filter((d) => d.change > 0).length;
  const falling = shown.filter((d) => d.change < 0).length;
  const k = kpi.rows?.[0] || {};
  const totalPct = k.baseline ? (k.recent - k.baseline) / k.baseline : null;
  const dark = isDark();

  // Map: one bubble per LAPD area, for the selected offense (or everything)
  const mapData = useMemo(() => {
    const byArea = rollUp(sel?.offense ? baseRows.filter((r) => r.offense === sel.offense) : baseRows, "area");
    const c = new Map((centers.rows || []).map((r) => [r.area_name, r]));
    const pts = byArea.filter((d) => c.has(d.area));
    const maxN = Math.max(1, ...pts.map((d) => Math.max(d.recent, d.baseline)));
    const clamp = (x) => (Number.isFinite(x) ? Math.max(-0.5, Math.min(0.5, x)) : 0.5);
    return [{
      type: "scattermap", mode: "markers+text",
      lat: pts.map((d) => c.get(d.area).lat), lon: pts.map((d) => c.get(d.area).lon),
      text: pts.map((d) => signedPct(d.pct)), textposition: "middle center",
      textfont: { size: 10, color: dark ? "#fff" : "#111" },
      customdata: pts.map((d) => [d.area, fmt(d.baseline), fmt(d.recent), signed(d.change), signedPct(d.pct)]),
      hovertemplate: "<b>%{customdata[0]}</b><br>Baseline %{customdata[1]} → recent %{customdata[2]}<br>%{customdata[3]} (%{customdata[4]})<extra></extra>",
      marker: {
        size: pts.map((d) => 14 + 46 * Math.sqrt(Math.max(d.recent, d.baseline) / maxN)),
        color: pts.map((d) => clamp(d.pct)), cmin: -0.5, cmax: 0.5,
        colorscale: [[0, DOWN], [0.5, dark ? "#475569" : "#e5e7eb"], [1, UP]], opacity: 0.8,
        showscale: true, colorbar: { title: { text: "% change", side: "right" }, tickformat: "+.0%", thickness: 10, len: 0.6, x: 1, xanchor: "right" },
      },
    }];
  }, [baseRows, centers.rows, sel?.offense, dark]);
  const mapLayout = useMemo(() => ({
    map: { style: dark ? "carto-darkmatter" : "carto-positron", center: { lat: 34.05, lon: -118.4 }, zoom: 8.6 },
    margin: { l: 0, r: 0, t: 0, b: 0 }, uirevision: "keep",
  }), [dark]);

  // History: monthly counts with both windows shaded
  const histData = useMemo(() => [{
    type: "scatter", mode: "lines+markers", line: { color: "#0f766e", width: 2 }, marker: { size: 4 },
    x: (history.rows || []).map((d) => iso(d.occurred_month)), y: (history.rows || []).map((d) => d.offense_count),
    hovertemplate: "%{x|%b %Y}: %{y:,}<extra></extra>",
  }], [history.rows]);
  const band = (a, b, color, label) => ({
    type: "rect", xref: "x", yref: "paper", x0: a, x1: nextMonth(b), y0: 0, y1: 1, fillcolor: color, opacity: 0.14, line: { width: 0 },
    label: { text: label, textposition: "top center", font: { size: 11 } },
  });
  const histLayout = useMemo(() => ({
    margin: { l: 48, r: 12, t: 8, b: 32 },
    xaxis: { type: "date", tickformat: "%b %Y", gridcolor: GRID, range: ["2024-01-01", nextMonth(months[months.length - 1] || "2026-01-01")] },
    yaxis: { gridcolor: GRID, rangemode: "tozero" },
    shapes: ready ? [band(baseStart, baseEnd, "#64748b", "Baseline"), band(recentStart, end, UP, "Recent")] : [],
  }), [ready, baseStart, baseEnd, recentStart, end, months]);

  // Biggest movers in the current table (by change in count)
  const movers = useMemo(() => {
    const ups = [...shown].filter((d) => d.change > 0).sort((a, b) => b.change - a.change).slice(0, 8);
    const downs = [...shown].filter((d) => d.change < 0).sort((a, b) => a.change - b.change).slice(0, 8);
    // Plotly draws the first bar at the bottom: biggest fall ... biggest rise
    const rows = [...downs, ...ups.reverse()];
    const label = (d) => [d.offense, d.area].filter(Boolean).join(" · ");
    return { rows, data: [{
      type: "bar", orientation: "h", y: rows.map(label), x: rows.map((d) => d.change),
      marker: { color: rows.map((d) => (d.change > 0 ? UP : DOWN)) },
      customdata: rows.map((d) => [d.key, signedPct(d.pct)]),
      hovertemplate: "%{y}: %{x:+,} (%{customdata[1]})<extra></extra>",
    }] };
  }, [shown]);

  const baselineTooEarly = ready && baseStart < NIBRS_START;
  const windowText = ready ? `${rangeLabel(recentStart, end)} vs ${rangeLabel(baseStart, baseEnd)}` : "…";
  const cols = COLUMNS.filter((c) => !c.views || c.views.includes(view));
  const maxAbs = Math.max(1, ...shown.map((d) => Math.abs(d.change)));

  return (
    <div className="lc">
      <style>{BASE_CSS + CSS}</style>
      <header className="lc-head">
        <h1>{dashboard?.title || "Rising Crimes"}</h1>
        <p>Which crimes are increasing the most, and where. Offense counts in a recent window are compared with a baseline window, for every offense type in every LAPD area.</p>
      </header>

      <div className="lc-filters rc-filters">
        <div className="lc-group">
          <h4>Compare</h4>
          <div className="lc-row">
            <label>Recent window</label>
            <Toggle label="Window length" value={n} onChange={(v) => setWin(Number(v))}
              options={[[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "12 months"]]} />
          </div>
          <div className="lc-row">
            <label>Baseline</label>
            <Toggle label="Baseline" value={base} onChange={setBase}
              options={[["year", "Same months a year earlier"], ["prev", "Previous period"]]} />
          </div>
          <div className="lc-row">
            <label htmlFor="rc-end">Ending</label>
            <select id="rc-end" value={end || ""} onChange={(e) => setEndPick(e.target.value === lastComplete ? "" : e.target.value)}>
              {[...months].reverse().map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{m === lastComplete ? " (latest complete)" : ""}</option>
              ))}
            </select>
          </div>
          <p className="lc-foot rc-window"><strong>{windowText}</strong>
            {baselineTooEarly && <span className="lc-warn"> · The baseline starts before NIBRS reporting began (Mar 2024), so it is undercounted.</span>}
          </p>
        </div>
        <div className="lc-group">
          <h4>Crime filters</h4>
          <Controls>
            <Given name="CRIME_AGAINST" />
            <Given name="OFFENSE" />
            <Given name="AREA" />
            <MultiSelect given="WEEKDAYS" />
          </Controls>
        </div>
      </div>

      <div className="lc-kpis">
        <div className="lc-kpi"><span>Recent offenses</span><strong>{fmt(k.recent)}</strong><small>{ready ? rangeLabel(recentStart, end) : ""}</small></div>
        <div className="lc-kpi"><span>Baseline offenses</span><strong>{fmt(k.baseline)}</strong><small>{ready ? rangeLabel(baseStart, baseEnd) : ""}</small></div>
        <div className="lc-kpi"><span>Overall change</span>
          <strong style={{ color: totalPct > 0 ? UP : totalPct < 0 ? DOWN : undefined }}>{totalPct == null ? "–" : signedPct(totalPct)}</strong>
          <small>{k.recent == null ? "" : `${signed(k.recent - k.baseline)} offenses`}</small></div>
        <div className="lc-kpi"><span>Rising / falling</span><strong><b style={{ color: UP }}>{rising}</b> / <b style={{ color: DOWN }}>{falling}</b></strong>
          <small>rows in the table below</small></div>
      </div>

      <div className="lc-grid rc-grid">
        <Card span={2} rows={3} title="Offenses ranked by change" note={
          <Toggle label="Group by" value={view} onChange={(v) => { setView(v); setSelected(null); }} options={VIEWS} />
        }>
          <div className="lc-row">
            <input type="search" placeholder="Search offense or area" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
            <label htmlFor="rc-min">Min. offenses in either window</label>
            <input id="rc-min" type="number" min={0} step={5} value={minCount} onChange={(e) => setMinCount(Number(e.target.value))} style={{ width: 72 }} />
            <span className="lc-note">{fmt(shown.length)} rows · click a header to sort, a row to chart it</span>
          </div>
          <Status q={grid}>
            <div className="rc-table-wrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} className={c.num ? "num" : ""} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button onClick={() => onSort(c.key)}>
                          {c.label}{sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                        </button>
                      </th>
                    ))}
                    <th className="rc-barcol" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 500).map((d) => (
                    <tr key={d.key} className={sel?.key === d.key ? "on" : ""} onClick={() => setSelected(sel?.key === d.key ? null : d)}>
                      {cols.map((c) => {
                        const v = d[c.key];
                        const style = (c.key === "change" || c.key === "pct") && d.change ? { color: d.change > 0 ? UP : DOWN } : undefined;
                        return (
                          <td key={c.key} className={c.num ? "num" : ""} style={style}>
                            {c.key === "change" ? signed(v) : c.key === "pct" ? signedPct(v) : c.num ? fmt(v) : v}
                          </td>
                        );
                      })}
                      <td className="rc-barcol">
                        <span className="rc-bar" style={{
                          width: `${(Math.abs(d.change) / maxAbs) * 50}%`,
                          left: d.change >= 0 ? "50%" : `${50 - (Math.abs(d.change) / maxAbs) * 50}%`,
                          background: d.change >= 0 ? UP : DOWN,
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length > 500 && <p className="lc-foot">Showing the first 500 rows. Raise the minimum or search to narrow the list.</p>}
            </div>
          </Status>
        </Card>

        <Card title={sel?.offense ? `Where ${sel.offense} is changing` : "Where offenses are changing"}
          note={sel ? <button className="lc-link" onClick={() => setSelected(null)}>Show all offenses</button> : "bubble size = offenses, colour = % change"}>
          <Status q={grid}><div className="rc-map"><Plot data={mapData} layout={mapLayout} height={380} /></div></Status>
        </Card>

        <Card title={sel ? [sel.offense, sel.area].filter(Boolean).join(" · ") : "All offenses in view"} note="offenses per month">
          <Status q={history}><Plot data={histData} layout={histLayout} height={230} /></Status>
        </Card>

        <Card title="Biggest movers" note="largest rises and falls in the table">
          {movers.rows.length
            ? <Plot data={movers.data} height={Math.max(160, 20 * movers.rows.length + 40)}
                layout={{ margin: { l: 8, r: 16, t: 4, b: 28 }, yaxis: { automargin: true }, xaxis: { gridcolor: GRID, zeroline: true, tickformat: "+," }, bargap: 0.25 }}
                onClick={(p) => setSelected(shown.find((d) => d.key === p.customdata[0]) || null)} />
            : <div className="lc-msg">No rows to compare.</div>}
        </Card>
      </div>

      <footer className="lc-footer">
        Crimes are often reported weeks after they happen, so the latest months are a little undercounted until later refreshes fill them in;
        comparing with the same months a year earlier also removes seasonal swings. Small counts swing a lot in percentage terms: use the minimum to hide them.
        Source: City of Los Angeles open data, LAPD NIBRS Offenses.
      </footer>
    </div>
  );
}

const CSS = `
.rc-filters { grid-template-columns: 1.1fr 1fr; }
.rc-window { margin-top: 4px; }
.rc-map { padding-bottom: 26px; }
.rc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rc-table-wrap { max-height: 760px; overflow: auto; border-top: 1px solid var(--edge); }
.rc-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.rc-table th { position: sticky; top: 0; background: var(--dash-bg, #fff); z-index: 1; text-align: left; border-bottom: 1px solid var(--edge); padding: 0; }
.rc-table th button { all: unset; cursor: pointer; display: block; padding: 6px 8px; font-weight: 600; width: 100%; box-sizing: border-box; }
.rc-table th.num button { text-align: right; }
.rc-table td { padding: 4px 8px; border-bottom: 1px solid var(--edge); white-space: nowrap; }
.rc-table td.num, .rc-table th.num { text-align: right; }
.rc-table tbody tr { cursor: pointer; }
.rc-table tbody tr:hover { background: rgba(128,128,128,.08); }
.rc-table tbody tr.on { background: rgba(37,99,235,.14); }
.rc-barcol { width: 120px; position: relative; }
.rc-bar { position: absolute; top: 30%; height: 40%; border-radius: 2px; opacity: .75; }
`;
