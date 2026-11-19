-- LAPD NIBRS Victims (data.lacity.org gqf2-vm2j) -> data/lapd_nibrs_victims.parquet
-- Streams the CSV straight from the Socrata export URL. Types follow the
-- portal's data dictionary (see scripts/offenses.sql for the mapping).
-- Victims-specific notes (verified against the source):
--   * This feed drops leading zeros from AREA ('1'), RPT Dist No ('314') and
--     Time OCC ('5' = 00:05). They are padded back to the canonical format the
--     Offenses feed uses ('01', '0314', 00:05) so the two datasets line up.
--   * "Date OCC" is always midnight here; the time of day is in time_occ.
--   * "Vict Age" is Text in the dictionary but every value is a whole number
--     (or blank), so it is stored as INTEGER.
--   * "Victim Shot" YES/NO -> BOOLEAN.
SET preserve_insertion_order = false;

COPY (
  SELECT
    CaseNo                                         AS case_no,
    UniqueVictimNo                                 AS unique_victim_no,
    strptime("Date Rptd", '%m/%d/%Y %I:%M:%S %p')  AS date_rptd,
    strptime("Date OCC",  '%m/%d/%Y %I:%M:%S %p')  AS date_occ,
    strptime(lpad("Time OCC", 4, '0'), '%H%M')::TIME AS time_occ,
    lpad(AREA, 2, '0')                             AS area,
    trim("AREA NAME")                              AS area_name,
    lpad("RPT Dist No", 4, '0')                    AS rpt_dist_no,
    TotalVictimCount::INTEGER                      AS total_victim_count,
    VictimOfsList                                  AS victim_ofs_list,
    "Vict Age"::INTEGER                            AS vict_age,
    "Vict Sex"                                     AS vict_sex,
    "Vict Descent"                                 AS vict_descent,
    "Victim Type"                                  AS victim_type,
    upper("Victim Shot") = 'YES'                   AS victim_shot,
    Status                                         AS status,
    "Status Desc"                                  AS status_desc
  FROM read_csv('https://data.lacity.org/api/views/gqf2-vm2j/rows.csv?accessType=DOWNLOAD',
                header = true, all_varchar = true)
  ORDER BY area, date_occ, time_occ
) TO 'data/lapd_nibrs_victims.parquet' (FORMAT parquet, COMPRESSION zstd);
