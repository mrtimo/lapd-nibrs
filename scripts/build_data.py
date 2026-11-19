"""Run one of the conversion SQL files with DuckDB and print a summary.

Usage: python scripts/build_data.py scripts/offenses.sql
"""
import pathlib
import sys
import time

import duckdb

sql_file = pathlib.Path(sys.argv[1])
pathlib.Path("data").mkdir(exist_ok=True)

t = time.perf_counter()
con = duckdb.connect()
con.execute(sql_file.read_text())

out = next(line.split("'")[1] for line in sql_file.read_text().splitlines()
           if line.lstrip().startswith(") TO '"))
rows = con.sql(f"SELECT count(*) FROM '{out}'").fetchone()[0]
if rows == 0:
    sys.exit(f"{out}: 0 rows - refusing to publish an empty file")
mb = pathlib.Path(out).stat().st_size / 1e6
print(f"{out}: {rows:,} rows, {mb:.1f} MB in {time.perf_counter() - t:.1f}s")
print(con.sql(f"DESCRIBE SELECT * FROM '{out}'"))
