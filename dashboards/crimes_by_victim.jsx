// Crimes x Victims: which offenses happen most to which kinds of victims.
// Every victim row names the offense that victim suffered, so each cross-tab
// is offense x one victim attribute, counted in victims. A heatmap shows the
// chosen attribute; the bar charts drill into the clicked cell.
import React, { useMemo } from "react";
import { Controls, Given, MultiSelect, useQuery, useUrlState } from "@malloyyo/dashboard";
import { BASE_CSS, Card, DOWN, GRID, MonthSlider, Plot, SEQ, Status, Toggle, UP, fmt, iso, isDark, pctFmt } from "./lib/ui.jsx";

const BREAKDOWNS = {
  type: { label: "Victim type", query: "offense_by_type", unknown: ["Not recorded"] },
  descent: { label: "Descent", query: "offense_by_descent", unknown: ["Not recorded", "Unknown"] },
  sex: { label: "Sex", query: "offense_by_sex", unknown: ["Not recorded", "Unknown"] },
  age: { label: "Age", query: "offense_by_age", unknown: ["Not recorded"], order: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "Not recorded"] },
};
const MODES = [
  ["col", "% of group's victims"],
  ["row", "% of crime's victims"],
  ["count", "Victims"],
  ["index", "Over / under-represented"],
];
const MODE_HELP = {
  col: "Each column adds to 100%: the crimes this group of victims suffers most.",
  row: "Each row adds to 100%: who the victims of each crime are.",
  count: "Number of victims.",
  index: "How much more (red) or less (blue) often this group is the victim of this crime than of crime overall. 2× = twice its usual share. Cells under 10 victims are left blank.",
};
const MIX_COLORS = ["#2563eb", "#f97316", "#10b981", "#a855f7", "#e11d48", "#0891b2", "#facc15", "#64748b", "#db2777", "#4d7c0f", "#7c3aed", "#0d9488", "#9ca3af", "#b45309"];

// Turn long rows {victim_offense, grp, victim_count} into a matrix.
function crossTab(rows, { unknown, order }, hideUnknown, topN) {
  const keep = rows.filter((r) => r.victim_offense !== "Not coded" && !(hideUnknown && unknown.includes(r.grp)));
  const rowTot = new Map(), colTot = new Map(), cell = new Map();
  let total = 0;
  for (const r of keep) {
    const n = r.victim_count || 0;
    rowTot.set(r.victim_offense, (rowTot.get(r.victim_offense) || 0) + n);
    colTot.set(r.grp, (colTot.get(r.grp) || 0) + n);
    cell.set(`${r.victim_offense}|${r.grp}`, n);
    total += n;
  }
  const offenses = [...rowTot.keys()].sort((a, b) => rowTot.get(b) - rowTot.get(a)).slice(0, topN || undefined);
  const groups = order
    ? order.filter((g) => colTot.has(g))
    : [...colTot.keys()].sort((a, b) => colTot.get(b) - colTot.get(a));
  const get = (o, g) => cell.get(`${o}|${g}`) || 0;
  return { offenses, groups, rowTot, colTot, total, get };
}

export default function Dashboard({ dashboard, givens }) {
  const [by, setBy] = useUrlState("by", "descent");
  const [modeRaw, setMode] = useUrlState("mode", "col");
  const mode = MODES.some(([m]) => m === modeRaw) ? modeRaw : "col"; // ignore a bad ?~mode=
  const [topN, setTopN] = useUrlState("top", 20);
  const [hideUnknown, setHideUnknown] = useUrlState("known", true);
  const [sel, setSel] = useUrlState("cell", null); // { offense, grp }

  const bd = BREAKDOWNS[by] || BREAKDOWNS.descent;
  const mixKey = bd === BREAKDOWNS.type ? "descent" : "type";
  const mixBd = BREAKDOWNS[mixKey];

  const kpi = useQuery({ query: "crimes_by_victim", givens });
  const main = useQuery({ query: bd.query, givens });
  const mix = useQuery({ query: mixBd.query, givens });
  const monthsQ = useQuery({ query: "victim_months", givens: {} });
  const months = useMemo(() => (monthsQ.rows || []).map((r) => iso(r.occurred_month)), [monthsQ.rows]);
  const dark = isDark();

  const ct = useMemo(() => crossTab(main.rows || [], bd, hideUnknown, Number(topN)), [main.rows, bd, hideUnknown, topN]);
  const k = kpi.rows?.[0] || {};

  // the clicked cell, falling back to the top offense and the biggest group
  const offense = sel && ct.rowTot.has(sel.offense) ? sel.offense : ct.offenses[0];
  const grp = sel && ct.colTot.has(sel.grp) ? sel.grp : ct.groups.find((g) => !bd.unknown.includes(g)) || ct.groups[0];

  // Heatmap ------------------------------------------------------------------
  const heat = useMemo(() => {
    const { offenses, groups, rowTot, colTot, total, get } = ct;
    const value = (o, g) => {
      const n = get(o, g);
      if (mode === "count") return n;
      if (mode === "row") return rowTot.get(o) ? n / rowTot.get(o) : 0;
      if (mode === "col") return colTot.get(g) ? n / colTot.get(g) : 0;
      if (n < 10) return null; // index: too few victims to say
      return (n / rowTot.get(o)) / (colTot.get(g) / total);
    };
    const z = offenses.map((o) => groups.map((g) => {
      const v = value(o, g);
      return mode === "index" ? (v == null ? null : Math.log2(v)) : v;
    }));
    const text = offenses.map((o) => groups.map((g) => {
      const v = value(o, g);
      if (v == null) return "";
      if (mode === "count") return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v);
      if (mode === "index") return `${v.toFixed(1)}×`;
      return v >= 0.995 ? "100%" : v < 0.005 ? (v ? "<1%" : "") : `${(v * 100).toFixed(0)}%`;
    }));
    const custom = offenses.map((o) => groups.map((g) => [fmt(get(o, g)), pctFmt(get(o, g) / (rowTot.get(o) || 1), 1), pctFmt(get(o, g) / (colTot.get(g) || 1), 1)]));
    const idx = mode === "index";
    const zmaxShare = Math.max(0.01, ...z.flat().filter((v) => v != null));
    return [{
      type: "heatmap", x: groups, y: offenses, z, text, texttemplate: groups.length <= 16 ? "%{text}" : "",
      textfont: { size: 10 }, customdata: custom, xgap: 1, ygap: 1, hoverongaps: false,
      hovertemplate: "<b>%{y}</b> · %{x}<br>%{customdata[0]} victims<br>%{customdata[1]} of this crime's victims<br>%{customdata[2]} of this group's victims<extra></extra>",
      colorscale: idx ? [[0, DOWN], [0.5, dark ? "#1f2937" : "#f8fafc"], [1, UP]] : SEQ,
      zmid: idx ? 0 : undefined, zmin: idx ? -2 : 0, zmax: idx ? 2 : (mode === "count" ? undefined : Math.min(1, zmaxShare)),
      showscale: idx,
      colorbar: idx ? { thickness: 10, len: 0.5, tickvals: [-2, -1, 0, 1, 2], ticktext: ["¼×", "½×", "1×", "2×", "4×"] } : undefined,
    }];
  }, [ct, mode, dark]);
  const heatHeight = Math.max(260, 26 * ct.offenses.length + 120);
  const heatLayout = useMemo(() => ({
    margin: { l: 8, r: 8, t: 8, b: 8 },
    xaxis: { side: "top", automargin: true, tickangle: ct.groups.length > 8 ? -35 : 0, fixedrange: true },
    yaxis: { automargin: true, autorange: "reversed", fixedrange: true },
    shapes: offense && grp ? [{
      type: "rect", xref: "x", yref: "y", line: { color: dark ? "#fff" : "#111", width: 2 },
      x0: ct.groups.indexOf(grp) - 0.5, x1: ct.groups.indexOf(grp) + 0.5,
      y0: ct.offenses.indexOf(offense) - 0.5, y1: ct.offenses.indexOf(offense) + 0.5,
    }].filter((s) => s.x0 >= -0.5 && s.y0 >= -0.5) : [],
  }), [ct, offense, grp, dark]);

  // Drill-down bars ------------------------------------------------------------
  const hbar = (labels, values, shares, color) => [{
    type: "bar", orientation: "h", y: [...labels].reverse(), x: [...values].reverse(),
    text: [...shares].reverse().map((s) => pctFmt(s, 0)), textposition: "outside", cliponaxis: false,
    marker: { color }, hovertemplate: "%{y}: %{x:,} (%{text})<extra></extra>",
  }];
  const hbarLayout = (n) => ({ margin: { l: 8, r: 40, t: 4, b: 28 }, yaxis: { automargin: true }, xaxis: { gridcolor: GRID }, bargap: 0.25, height: Math.max(160, 22 * n + 40) });

  const topForGroup = useMemo(() => {
    if (!grp) return null;
    const all = (main.rows || []).filter((r) => r.grp === grp && r.victim_offense !== "Not coded");
    const tot = all.reduce((s, r) => s + r.victim_count, 0);
    const top = all.sort((a, b) => b.victim_count - a.victim_count).slice(0, 12);
    return { n: top.length, data: hbar(top.map((r) => r.victim_offense), top.map((r) => r.victim_count), top.map((r) => r.victim_count / tot), "#7c3aed") };
  }, [main.rows, grp]);

  const groupsForOffense = useMemo(() => {
    if (!offense) return null;
    const gs = ct.groups;
    const vals = gs.map((g) => ct.get(offense, g));
    const tot = vals.reduce((s, v) => s + v, 0) || 1;
    const order = bd.order ? gs.map((_, i) => i) : gs.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
    return { n: gs.length, data: hbar(order.map((i) => gs[i]), order.map((i) => vals[i]), order.map((i) => vals[i] / tot), "#db2777") };
  }, [ct, offense, bd]);

  // Victim-type (or descent) mix of each crime, 100% stacked ------------------
  const mixChart = useMemo(() => {
    const m = crossTab(mix.rows || [], mixBd, hideUnknown, Number(topN));
    const offenses = ct.offenses.filter((o) => m.rowTot.has(o));
    const data = m.groups.map((g, i) => ({
      type: "bar", orientation: "h", name: g, y: offenses,
      x: offenses.map((o) => m.get(o, g) / (m.rowTot.get(o) || 1)),
      customdata: offenses.map((o) => fmt(m.get(o, g))),
      marker: { color: MIX_COLORS[i % MIX_COLORS.length] },
      hovertemplate: `<b>%{y}</b><br>${g}: %{x:.0%} (%{customdata} victims)<extra></extra>`,
    }));
    return { data, n: offenses.length };
  }, [mix.rows, mixBd, hideUnknown, topN, ct.offenses]);

  return (
    <div className="lc">
      <style>{BASE_CSS + CSS}</style>
      <header className="lc-head">
        <h1>{dashboard?.title || "Crimes × Victims"}</h1>
        <p>Which crimes happen most to which kinds of victims. Each victim in the LAPD NIBRS Victims data is linked to the offense they suffered, so these charts count victims.</p>
      </header>

      <div className="lc-filters cv-filters">
        <div className="lc-group">
          <h4>Victim</h4>
          <Controls>
            <Given name="VICTIM_TYPE" />
            <Given name="VICTIM_SEX" />
            <Given name="VICTIM_DESCENT" />
            <Given name="VICTIM_AGE" />
          </Controls>
        </div>
        <div className="lc-group">
          <h4>Where and when</h4>
          <Controls><Given name="AREA" /></Controls>
          {months.length > 1 ? <MonthSlider months={months} /> : <div className="lc-msg">Loading months…</div>}
          <Controls><MultiSelect given="WEEKDAYS" /></Controls>
        </div>
      </div>

      <div className="lc-kpis">
        <div className="lc-kpi"><span>Victims</span><strong>{fmt(k.victim_count)}</strong></div>
        <div className="lc-kpi"><span>People (not businesses etc.)</span><strong>{fmt(k.people)}</strong><small>{k.victim_count ? pctFmt(k.people / k.victim_count) + " of victims" : ""}</small></div>
        <div className="lc-kpi"><span>Offense types</span><strong>{fmt(k.offense_types)}</strong></div>
        <div className="lc-kpi"><span>Average victim age</span><strong>{k.average_age == null ? "–" : k.average_age.toFixed(1)}</strong><small>adults with a recorded age</small></div>
      </div>

      <div className="lc-row cv-controls">
        <label>Victims by</label>
        <Toggle label="Victim attribute" value={by} onChange={(v) => { setBy(v); setSel(null); }}
          options={Object.entries(BREAKDOWNS).map(([key, b]) => [key, b.label])} />
        <label>Show</label>
        <Toggle label="Measure" value={mode} onChange={setMode} options={MODES} />
        <label htmlFor="cv-top">Crimes</label>
        <select id="cv-top" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
          {[[10, "Top 10"], [20, "Top 20"], [30, "Top 30"], [0, "All"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <label><input type="checkbox" checked={!hideUnknown} onChange={(e) => setHideUnknown(!e.target.checked)} /> Include “Not recorded” / “Unknown”</label>
      </div>

      <div className="lc-grid cv-grid">
        <Card span={2} rows={2} title={`Crimes by ${bd.label.toLowerCase()} of victim`} note="click a cell to drill in">
          <p className="lc-foot">{MODE_HELP[mode]}</p>
          <Status q={main}>
            <Plot data={heat} layout={heatLayout} height={heatHeight}
              onClick={(p) => setSel({ offense: p.y, grp: p.x })} />
          </Status>
        </Card>

        <Card title={grp ? `Most common crimes against ${by === "age" ? `victims aged ${grp}` : grp + (by === "type" ? " victims" : "")}` : "Most common crimes"} note="% of this group's victims">
          <Status q={main}>{topForGroup && <Plot data={topForGroup.data} layout={hbarLayout(topForGroup.n)} height={hbarLayout(topForGroup.n).height}
            onClick={(p) => setSel({ offense: p.y, grp })} />}</Status>
        </Card>

        <Card title={offense ? `Who the victims of ${offense} are` : "Victims of the selected crime"} note={`by ${bd.label.toLowerCase()}`}>
          <Status q={main}>{groupsForOffense && <Plot data={groupsForOffense.data} layout={hbarLayout(groupsForOffense.n)} height={hbarLayout(groupsForOffense.n).height}
            onClick={(p) => setSel({ offense, grp: p.y })} />}</Status>
        </Card>

        <Card span={3} title={`${mixBd.label} mix of each crime's victims`} note="same crimes as the heatmap; each bar adds to 100%">
          <Status q={mix}>
            <Plot data={mixChart.data} height={Math.max(240, 24 * mixChart.n + 90)}
              layout={{ barmode: "stack", margin: { l: 8, r: 8, t: 8, b: 28 }, yaxis: { automargin: true, autorange: "reversed" },
                xaxis: { tickformat: ".0%", range: [0, 1], gridcolor: GRID }, legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, traceorder: "normal" }, bargap: 0.2 }} />
          </Status>
        </Card>
      </div>

      <footer className="lc-footer">
        Offense types with no NIBRS code are left out. Descent is only recorded for people, and age only for adults.
        Source: City of Los Angeles open data, LAPD NIBRS Victims.
      </footer>
    </div>
  );
}

const CSS = `
.cv-filters { grid-template-columns: 1.3fr 1.2fr; }
.cv-controls { margin: 0 0 12px; gap: 8px 12px; }
.cv-controls label { display: inline-flex; align-items: center; gap: 4px; }
`;
