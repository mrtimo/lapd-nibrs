# LAPD NIBRS: offenses & victims as parquet + an LA crime map

**Live dashboards:**
- [LA Crime Map](https://mrtimo.github.io/lapd-nibrs/crime_map.html): where crime happens, with crime, victim and time filters.
- [Rising Crimes](https://mrtimo.github.io/lapd-nibrs/rising_crimes.html): a sortable table of which offenses are rising or falling the most, and in which LAPD areas.
- [Crimes × Victims](https://mrtimo.github.io/lapd-nibrs/crimes_by_victim.html): which offenses happen most to which victim types, descents, sexes and ages.

The City of Los Angeles publishes LAPD crime data in the FBI's NIBRS format as two
CSV datasets. This repo turns them into typed, compressed parquet files, keeps those
files current automatically, and builds a Malloy semantic model and a static
dashboard on top of them.

| Dataset | Source | Parquet (in this repo) |
|---|---|---|
| Offenses (one row per offense) | [k7nn-b2ep](https://data.lacity.org/Public-Safety/LAPD-NIBRS-Offenses-Dataset/k7nn-b2ep/about_data) | [`data/lapd_nibrs_offenses.parquet`](data/lapd_nibrs_offenses.parquet) |
| Victims (one row per victim) | [gqf2-vm2j](https://data.lacity.org/Public-Safety/LAPD-NIBRS-Victims-Dataset/gqf2-vm2j/about_data) | [`data/lapd_nibrs_victims.parquet`](data/lapd_nibrs_victims.parquet) |

Read them from anywhere:

```sql
-- DuckDB
SELECT * FROM 'https://raw.githubusercontent.com/mrtimo/lapd-nibrs/main/data/lapd_nibrs_offenses.parquet';
```

## How the data is built

`scripts/offenses.sql` and `scripts/victims.sql` are single DuckDB statements: each
one streams the Socrata CSV export URL with `read_csv` and `COPY`s it straight to zstd
parquet. The CSV is never saved to disk. Run one locally with
`python scripts/build_data.py scripts/offenses.sql`.

Column types follow the portal's data dictionaries:
- **Text** columns are stored as `VARCHAR`, and codes keep their leading zeros.
- **Floating Timestamp** columns are stored as `TIMESTAMP`.
- **Number** columns are stored as `INTEGER` or `DOUBLE`.

A few deliberate refinements, each checked against the source so nothing is lost:
- **`time_occ`:** stored as `TIME`.
- **YES/NO flags:** stored as `BOOLEAN`.
- **`vict_age`:** stored as `INTEGER` (every value is a whole number).
- **`area_name`:** trimmed, because the source pads it with spaces.
- **`lat` / `lon`:** a location of 0,0 means none was recorded, so it is stored as blank.
- **Victims codes:** the victims feed drops leading zeros from `AREA`, `RPT Dist No` and
  `Time OCC`. These are padded back so they match the offenses feed.

Rows are sorted by area, then date, then the unique ID. Because of that, rebuilding
unchanged source data gives a byte-identical file, so a refresh with nothing new makes
no commit.

## Automatic refresh

Two GitHub Actions workflows rebuild each file on the **1st, 10th and 21st of every
month** and overwrite it in `data/`:
- [`refresh-offenses.yml`](.github/workflows/refresh-offenses.yml) runs at 09:00 UTC.
- [`refresh-victims.yml`](.github/workflows/refresh-victims.yml) runs at 09:30 UTC.

Both can also be run by hand from the Actions tab. The dashboard reads the parquet from
`raw.githubusercontent.com` when the page opens, so the live site shows new data without
being rebuilt.

## Malloy model and dashboard

| File | What it is |
|---|---|
| `storage.malloy` | Points the sources at the parquet files on GitHub. |
| `lapd.malloy` | The semantic model: `offenses` and `victims` sources with `#"` docs, `public`/`internal` access modifiers, readable dimensions (NIBRS offense names, victim sex/descent/age group, day of week, hour), measures, and joins on `case_no` in both directions. |
| `givens.malloy` | The dashboard filters: crime against, offense, LAPD area, victim type/sex/descent/age, days of week, months. |
| `index.malloy` | The export surface (`offenses`, `victims`). |
| `dashboards/crime_map.malloy` | The dashboard's queries. All nine filters apply to every chart. |
| `dashboards/rising_crimes.malloy` / `.jsx` | Rising Crimes: compares a recent window (1, 3, 6 or 12 months) with the same months a year earlier or the previous period, for every offense in every area. Sortable table, area map of % change, monthly history of the selected row, biggest movers. |
| `dashboards/crimes_by_victim.malloy` / `.jsx` | Crimes × Victims: heatmap of offense by victim type, descent, sex or age (counts, row %, column %, or over/under-representation), drill-down bars, and each crime's victim-type mix. |
| `dashboards/lib/ui.jsx` | Shared Plotly wrapper, cards, toggles, month slider and styles for the two dashboards above. |
| `dashboards/crime_map.jsx` | The layout, built with Plotly: a heatmap or hundred-block map of LA, top offenses, offenses by month, a day × hour heatmap, offenses by area, and victim breakdowns. It also has the crime and victim dropdowns, a month range slider and a day-of-week multi-select. |

The site in `docs/` is static. Malloy compiles in the browser and DuckDB-WASM runs the
queries, so there is no server.

To rebuild it after changing the model or dashboard:

```bash
npm install                                   # Plotly, bundled into the page
malloyyo lint
malloyyo dashboard bundle --out docs --title "LA Crime Map"
git add docs && git commit -m "Rebuild dashboard" && git push
```

`malloyyo dashboard dev` previews it live at http://localhost:4173. Charts render there,
but the dev preview runs in a sandboxed frame with no network, so the map's background
tiles only show in the bundled build (`bundle` serves it at http://localhost:4180).

The static site caps each query at 5,000 rows, so the map query returns its ~49k
hundred-block points as a nested list inside a single row.

## Notes on the data

- LAPD started reporting in NIBRS in March 2024, so earlier occurrence dates are late
  reports. A few dates are clearly wrong (the oldest is in 1800).
- A victim filter keeps the offenses whose incident had at least one matching victim.
- Locations are rounded to the hundred block by LAPD.
- Each victim row names the one offense that victim suffered (`victim_ofs_list`); the
  model exposes it as `victims.victim_offense`, so Crimes × Victims counts victims, not cases.
- Crimes are often reported weeks after they occur, so the most recent months are
  undercounted until later refreshes; Rising Crimes defaults to the last complete month
  and compares with the same months a year earlier.

## Git history size

Each data refresh that changes a file commits a new copy, about 24 MB for both files.
If the history gets large, squash it (this force-pushes, so other clones must reset):

```bash
git checkout --orphan flat && git add -A && git commit -m "Flatten history"
git branch -M flat main && git push -f origin main
```
