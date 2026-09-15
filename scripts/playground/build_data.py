"""Snapshot the public GitHub activity of juanberrio0399 into small Arrow IPC files
for the in-browser SQL playground (playground.html).

Everything comes from the public GitHub REST API: nothing is estimated or made up.
Run it again to refresh the snapshot; the `snapshot` table records when it was taken.

Arrow IPC (not Parquet) on purpose: DuckDB-WASM ingests Arrow natively, while Parquet would
make the browser download the parquet extension from a second host at runtime.

    pip install duckdb pyarrow
    GITHUB_TOKEN=... python scripts/playground/build_data.py   # token optional, avoids rate limits
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pyarrow as pa

OWNER = "juanberrio0399"
API = "https://api.github.com"
OUT = Path(__file__).resolve().parents[2] / "assets" / "data" / "playground"


def get(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": f"{OWNER}-playground-snapshot",
    })
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def paginate(path: str):
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        items = get(f"{API}{path}{sep}per_page=100&page={page}")
        if not items:
            return
        yield from items
        if len(items) < 100:
            return
        page += 1


def main() -> None:
    repos = [r for r in paginate(f"/users/{OWNER}/repos?type=owner")
             if not r["fork"] and not r["private"]]

    repo_rows, lang_rows, commit_rows, pr_rows = [], [], [], []
    for r in repos:
        name = r["name"]
        repo_rows.append({
            "name": name,
            "description": r["description"],
            "language": r["language"],
            "topics": r.get("topics") or [],
            "license": (r.get("license") or {}).get("spdx_id"),
            "stars": r["stargazers_count"],
            "forks": r["forks_count"],
            "size_kb": r["size"],
            "created_at": r["created_at"],
            "pushed_at": r["pushed_at"],
        })
        for lang, size in get(f"{API}/repos/{OWNER}/{name}/languages").items():
            lang_rows.append({"repo": name, "language": lang, "bytes": size})
        # An empty repository answers 409 on /commits; treat it as zero commits.
        try:
            days = Counter(c["commit"]["author"]["date"][:10]
                           for c in paginate(f"/repos/{OWNER}/{name}/commits"))
        except urllib.error.HTTPError as e:
            if e.code != 409:
                raise
            days = Counter()
        commit_rows += [{"repo": name, "day": d, "commits": n} for d, n in sorted(days.items())]
        for p in paginate(f"/repos/{OWNER}/{name}/pulls?state=all"):
            pr_rows.append({
                "repo": name,
                "number": p["number"],
                "title": p["title"],
                "author": (p.get("user") or {}).get("login"),
                "created_at": p["created_at"],
                "closed_at": p["closed_at"],
                "merged_at": p["merged_at"],
            })

    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    tables = {
        "repos": (repo_rows, """name VARCHAR, description VARCHAR, language VARCHAR, topics VARCHAR[],
                                license VARCHAR, stars INTEGER, forks INTEGER, size_kb INTEGER,
                                created_at TIMESTAMP, pushed_at TIMESTAMP"""),
        "languages": (lang_rows, "repo VARCHAR, language VARCHAR, bytes BIGINT"),
        "commits_daily": (commit_rows, "repo VARCHAR, day DATE, commits INTEGER"),
        "pull_requests": (pr_rows, """repo VARCHAR, number INTEGER, title VARCHAR, author VARCHAR,
                                      created_at TIMESTAMP, closed_at TIMESTAMP, merged_at TIMESTAMP"""),
    }
    con.execute("SET TimeZone = 'UTC'")

    def write_arrow(table: str, relation: duckdb.DuckDBPyRelation) -> None:
        data = relation.to_arrow_table()
        # Uncompressed IPC stream: the format DuckDB-WASM's insertArrowFromIPCStream reads.
        with pa.OSFile(str(OUT / f"{table}.arrow"), "wb") as sink:
            with pa.ipc.new_stream(sink, data.schema) as writer:
                writer.write_table(data)
        print(f"{table}: {data.num_rows} rows")

    for table, (rows, schema) in tables.items():
        tmp = OUT / f"{table}.json"
        tmp.write_text(json.dumps(rows), encoding="utf-8")
        columns = ", ".join(f"'{c.split()[0]}': '{' '.join(c.split()[1:])}'"
                            for c in (part.strip() for part in schema.split(",")))
        write_arrow(table, con.sql(
            f"SELECT * FROM read_json('{tmp.as_posix()}', format='array', columns={{{columns}}})"))
        tmp.unlink()

    snapshot = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    write_arrow("snapshot", con.sql(
        f"SELECT TIMESTAMP '{snapshot}' AS taken_at, "
        f"'GitHub REST API · public repositories of {OWNER}' AS source"))
    print(f"snapshot: {snapshot} -> {OUT}")


if __name__ == "__main__":
    main()
