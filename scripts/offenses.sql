-- LAPD NIBRS Offenses (data.lacity.org k7nn-b2ep) -> data/lapd_nibrs_offenses.parquet
-- Streams the CSV straight from the Socrata export URL; nothing is saved to disk
-- except the parquet. Types follow the portal's data dictionary:
--   Text               -> VARCHAR (codes keep their leading zeros)
--   Floating Timestamp -> TIMESTAMP (no time zone)
--   Number             -> INTEGER / DOUBLE
-- Deliberate refinements (lossless, verified against the source):
--   "Time OCC" HHMM text -> TIME;  YES/NO flags -> BOOLEAN;
--   AREA NAME trimmed (source pads it); LAT/LON 0,0 (= no location) -> NULL.
SET preserve_insertion_order = false;

COPY (
  SELECT
    CaseNo                                         AS case_no,
    UniqueNIBRNo                                   AS unique_nibr_no,
    strptime("Date Rptd", '%m/%d/%Y %I:%M:%S %p')  AS date_rptd,
    strptime("Date OCC",  '%m/%d/%Y %I:%M:%S %p')  AS date_occ,
    strptime("Time OCC", '%H%M')::TIME             AS time_occ,
    AREA                                           AS area,         -- already zero-padded
    trim("AREA NAME")                              AS area_name,
    "RPT Dist No"                                  AS rpt_dist_no,
    TotalOffenseCount::INTEGER                     AS total_offense_count,
    "Group"                                        AS nibr_group,
    "NIBR Code"                                    AS nibr_code,
    "NIBR Description"                             AS nibr_description,
    "Crime Against"                                AS crime_against,
    "Premise Cd"                                   AS premise_cd,
    "Premise Desc"                                 AS premise_desc,
    "Weapon Used Cd"                               AS weapon_used_cd,
    "Weapon Desc"                                  AS weapon_desc,
    Status                                         AS status,
    "Status Desc"                                  AS status_desc,
    TotalVictimCount::INTEGER                      AS total_victim_count,
    upper("Victim Shot")             = 'YES'       AS victim_shot,
    upper("Domestic Violence Crime") = 'YES'       AS domestic_violence_crime,
    upper("Hate Crime")              = 'YES'       AS hate_crime,
    upper("Gang-related Crime")      = 'YES'       AS gang_related_crime,
    upper("Transit-related Crime")   = 'YES'       AS transit_related_crime,
    upper("Homeless-Victim Crime")   = 'YES'       AS homeless_victim_crime,
    upper("Homeless-Suspect Crime")  = 'YES'       AS homeless_suspect_crime,
    upper("Homeless-Arrestee Crime") = 'YES'       AS homeless_arrestee_crime,
    LOCATION                                       AS location,
    nullif(LAT::DOUBLE, 0)                         AS lat,
    nullif(LON::DOUBLE, 0)                         AS lon
  FROM read_csv('https://data.lacity.org/api/views/k7nn-b2ep/rows.csv?accessType=DOWNLOAD',
                header = true, all_varchar = true)
  -- area + date order clusters rows so area/date filters skip row groups
  ORDER BY area, date_occ, time_occ
) TO 'data/lapd_nibrs_offenses.parquet' (FORMAT parquet, COMPRESSION zstd);
