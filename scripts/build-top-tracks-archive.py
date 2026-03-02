#!/usr/bin/env python3
"""
Builds a compact top-tracks archive from local parquet snapshots.

Outputs:
  - SQLite DB: data/top-tracks-archive.sqlite
  - JSON index: data/top-tracks-archive.json

"""

from __future__ import annotations

import argparse
import datetime
import json
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    import duckdb  # type: ignore
except ImportError as exc:  # pragma: no cover - runtime guard
    raise SystemExit(
        "Missing dependency: duckdb.\n"
        "Use an isolated env, for example:\n"
        "  python3 -m venv /tmp/musicmap-venv\n"
        "  /tmp/musicmap-venv/bin/pip install duckdb\n"
        "  /tmp/musicmap-venv/bin/python scripts/build-top-tracks-archive.py\n"
    ) from exc


@dataclass(frozen=True)
class Paths:
    root: Path
    artist_cache_json: Path
    artists_parquet: Path
    tracks_parquet: Path
    track_artists_parquet: Path
    albums_parquet: Path
    album_images_parquet: Path


def normalize_artist_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def iter_artist_names_from_cache(cache_path: Path) -> Iterable[str]:
    if not cache_path.exists():
        return []

    with cache_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    names: set[str] = set()
    if isinstance(data, dict):
        for value in data.values():
            if not isinstance(value, dict):
                continue
            panel = value.get("panelData")
            if isinstance(panel, dict):
                artist = panel.get("artist")
                if isinstance(artist, dict):
                    name = artist.get("name")
                    if isinstance(name, str) and name.strip():
                        names.add(name.strip())
            graph = value.get("graphData")
            if isinstance(graph, dict):
                nodes = graph.get("nodes")
                if isinstance(nodes, list):
                    for node in nodes:
                        if isinstance(node, dict):
                            name = node.get("name")
                            if isinstance(name, str) and name.strip():
                                names.add(name.strip())

    return sorted(names)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a compact SQLite + JSON top-tracks archive from parquet snapshots."
        )
    )
    parser.add_argument(
        "--artist-cache",
        default="data/artist-cache.json",
        help="Path to artist cache JSON used to derive seed artists.",
    )
    parser.add_argument(
        "--artist-list",
        default=None,
        help="Optional newline-delimited file with additional artist names.",
    )
    parser.add_argument(
        "--artist",
        action="append",
        default=[],
        help="Additional artist name (can be passed multiple times).",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Top tracks to keep per artist (default: 10).",
    )
    parser.add_argument(
        "--sqlite-output",
        default="data/top-tracks-archive.sqlite",
        help="SQLite output path.",
    )
    parser.add_argument(
        "--json-output",
        default="data/top-tracks-archive.json",
        help="JSON output path for runtime lookups.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing output files.",
    )
    return parser.parse_args()


def build_paths(root: Path, artist_cache_arg: str) -> Paths:
    clean_parquet = root / "archive" / "clean_parquet"
    return Paths(
        root=root,
        artist_cache_json=(root / artist_cache_arg).resolve(),
        artists_parquet=(clean_parquet / "artists.parquet").resolve(),
        tracks_parquet=(clean_parquet / "tracks.parquet").resolve(),
        track_artists_parquet=(clean_parquet / "track_artists.parquet").resolve(),
        albums_parquet=(clean_parquet / "albums.parquet").resolve(),
        album_images_parquet=(clean_parquet / "album_images.parquet").resolve(),
    )


def load_seed_artists(args: argparse.Namespace, paths: Paths) -> list[str]:
    names = set(iter_artist_names_from_cache(paths.artist_cache_json))

    if args.artist_list:
        artist_list_path = (paths.root / args.artist_list).resolve()
        if artist_list_path.exists():
            with artist_list_path.open("r", encoding="utf-8") as fh:
                for raw in fh:
                    name = raw.strip()
                    if name:
                        names.add(name)

    for explicit in args.artist:
        if explicit and explicit.strip():
            names.add(explicit.strip())

    return sorted(names)


def ensure_output_path(path: Path, overwrite: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if overwrite:
            path.unlink()
        else:
            raise SystemExit(
                f"Output already exists: {path}\nUse --overwrite to replace it."
            )


def build_ranked_tracks_table(
    con: duckdb.DuckDBPyConnection,
    paths: Paths,
    normalized_artist_names: list[str],
    top_n: int,
) -> tuple[int, int]:
    con.execute("CREATE TEMP TABLE selected_names(normalized_name VARCHAR)")
    con.executemany(
        "INSERT INTO selected_names VALUES (?)",
        [(name,) for name in normalized_artist_names],
    )

    con.execute(
        """
        CREATE TEMP TABLE selected_artists AS
        SELECT
          artist_rowid,
          artist_name,
          normalized_name
        FROM (
          SELECT
            a.rowid AS artist_rowid,
            a.name AS artist_name,
            lower(trim(a.name)) AS normalized_name,
            row_number() OVER (
              PARTITION BY lower(trim(a.name))
              ORDER BY
                COALESCE(a.popularity, 0) DESC,
                COALESCE(a.followers_total, 0) DESC,
                a.rowid ASC
            ) AS pick_rank
          FROM read_parquet(?) AS a
          JOIN selected_names s
            ON lower(trim(a.name)) = s.normalized_name
        )
        WHERE pick_rank = 1
        """,
        [str(paths.artists_parquet)],
    )

    selected_artist_count = con.execute(
        "SELECT COUNT(*) FROM selected_artists"
    ).fetchone()[0]

    con.execute(
        """
        CREATE TEMP TABLE candidate_track_links AS
        SELECT
          sa.normalized_name,
          sa.artist_name,
          ta.track_rowid
        FROM read_parquet(?) ta
        JOIN selected_artists sa
          ON sa.artist_rowid = ta.artist_rowid
        """,
        [str(paths.track_artists_parquet)],
    )

    con.execute(
        """
        CREATE TEMP TABLE candidate_tracks AS
        SELECT
          ctl.normalized_name,
          ctl.artist_name,
          t.id AS track_id,
          t.name AS track_name,
          t.preview_url,
          COALESCE(t.duration_ms, 0) AS duration_ms,
          COALESCE(t.popularity, 0) AS popularity
        FROM candidate_track_links ctl
        JOIN read_parquet(?) t
          ON t.rowid = ctl.track_rowid
        WHERE
          t.id IS NOT NULL
          AND t.name IS NOT NULL
        """,
        [
            str(paths.tracks_parquet),
        ],
    )

    con.execute(
        """
        CREATE TEMP TABLE ranked_tracks AS
        WITH deduped_name AS (
          SELECT
            normalized_name,
            artist_name,
            track_id,
            track_name,
            preview_url,
            duration_ms,
            popularity,
            row_number() OVER (
              PARTITION BY normalized_name, lower(track_name)
              ORDER BY
                CASE WHEN COALESCE(preview_url, '') = '' THEN 0 ELSE 1 END DESC,
                popularity DESC,
                track_id ASC
            ) AS name_pick
          FROM candidate_tracks
        ),
        deduped AS (
          SELECT DISTINCT
            normalized_name,
            artist_name,
            track_id,
            track_name,
            preview_url,
            duration_ms,
            popularity
          FROM deduped_name
          WHERE name_pick = 1
        ),
        ranked AS (
          SELECT
            normalized_name,
            artist_name,
            track_id,
            track_name,
            preview_url,
            duration_ms,
            popularity,
            row_number() OVER (
              PARTITION BY normalized_name
              ORDER BY
                CASE WHEN COALESCE(preview_url, '') = '' THEN 0 ELSE 1 END DESC,
                popularity DESC,
                track_name ASC,
                track_id ASC
            ) AS rank
          FROM deduped
        )
        SELECT
          normalized_name,
          artist_name,
          rank,
          track_id,
          track_name,
          preview_url,
          duration_ms,
          popularity,
          '—' AS album_name,
          NULL AS album_image_url
        FROM ranked
        WHERE rank <= ?
        ORDER BY normalized_name, rank
        """,
        [top_n],
    )

    ranked_row_count = con.execute("SELECT COUNT(*) FROM ranked_tracks").fetchone()[0]
    return selected_artist_count, ranked_row_count


def write_sqlite(
    con: duckdb.DuckDBPyConnection,
    sqlite_path: Path,
) -> None:
    db = sqlite3.connect(sqlite_path)
    try:
        cur = db.cursor()
        cur.executescript(
            """
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE artist_top_tracks (
              normalized_artist_name TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              rank INTEGER NOT NULL,
              track_id TEXT NOT NULL,
              track_name TEXT NOT NULL,
              preview_url TEXT,
              duration_ms INTEGER NOT NULL DEFAULT 0,
              popularity INTEGER NOT NULL DEFAULT 0,
              album_name TEXT NOT NULL,
              album_image_url TEXT,
              PRIMARY KEY (normalized_artist_name, rank, track_id)
            );

            CREATE INDEX idx_artist_top_tracks_artist
              ON artist_top_tracks(normalized_artist_name, rank);
            """
        )

        rows = con.execute(
            """
            SELECT
              normalized_name,
              artist_name,
              rank,
              track_id,
              track_name,
              preview_url,
              COALESCE(duration_ms, 0) AS duration_ms,
              COALESCE(popularity, 0) AS popularity,
              album_name,
              album_image_url
            FROM ranked_tracks
            ORDER BY normalized_name, rank
            """
        )

        batch = rows.fetchmany(50_000)
        while batch:
            cur.executemany(
                """
                INSERT INTO artist_top_tracks (
                  normalized_artist_name,
                  artist_name,
                  rank,
                  track_id,
                  track_name,
                  preview_url,
                  duration_ms,
                  popularity,
                  album_name,
                  album_image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                batch,
            )
            batch = rows.fetchmany(50_000)

        db.commit()
    finally:
        db.close()


def write_json_index(
    con: duckdb.DuckDBPyConnection,
    json_path: Path,
) -> None:
    rows = con.execute(
        """
        SELECT
          normalized_name,
          artist_name,
          rank,
          track_id,
          track_name,
          preview_url,
          COALESCE(duration_ms, 0) AS duration_ms,
          COALESCE(popularity, 0) AS popularity,
          album_name,
          album_image_url
        FROM ranked_tracks
        ORDER BY normalized_name, rank
        """
    ).fetchall()

    payload: dict[str, dict[str, object]] = {}
    for (
        normalized_name,
        artist_name,
        _rank,
        track_id,
        track_name,
        preview_url,
        duration_ms,
        popularity,
        album_name,
        album_image_url,
    ) in rows:
        entry = payload.setdefault(
            normalized_name,
            {"artistName": artist_name, "tracks": []},
        )
        tracks = entry["tracks"]
        assert isinstance(tracks, list)
        tracks.append(
            {
                "id": track_id,
                "name": track_name,
                "preview_url": preview_url,
                "duration_ms": int(duration_ms or 0),
                "popularity": int(popularity or 0),
                "album": {
                    "name": album_name or "—",
                    "images": (
                        [{"url": album_image_url, "height": 0, "width": 0}]
                        if album_image_url
                        else []
                    ),
                },
                "artists": [{"name": artist_name}],
            }
        )

    output = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "artists": payload,
    }
    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=True, separators=(",", ":"))
        fh.write("\n")


def main() -> int:
    args = parse_args()
    if args.top_n <= 0:
        raise SystemExit("--top-n must be > 0")

    root = Path(__file__).resolve().parents[1]
    paths = build_paths(root, args.artist_cache)

    seed_artists = load_seed_artists(args, paths)
    if not seed_artists:
        raise SystemExit("No seed artists found. Provide --artist or --artist-list.")

    normalized = sorted({normalize_artist_name(name) for name in seed_artists})
    sqlite_output = (paths.root / args.sqlite_output).resolve()
    json_output = (paths.root / args.json_output).resolve()

    ensure_output_path(sqlite_output, args.overwrite)
    ensure_output_path(json_output, args.overwrite)

    print(f"Seed artists: {len(seed_artists)}", flush=True)
    print(f"Distinct normalized names: {len(normalized)}", flush=True)
    print("Building ranked track dataset from parquet snapshots...", flush=True)

    con = duckdb.connect()
    try:
        # Keep heavy joins/window ops from exhausting RAM.
        con.execute("SET temp_directory = '/tmp'")
        con.execute("SET preserve_insertion_order = false")
        con.execute("SET threads = 4")
        con.execute("SET memory_limit = '8GB'")

        selected_artist_count, ranked_rows = build_ranked_tracks_table(
            con=con,
            paths=paths,
            normalized_artist_names=normalized,
            top_n=args.top_n,
        )
        print(f"Matched artists in archive: {selected_artist_count}", flush=True)
        print(f"Ranked rows: {ranked_rows}", flush=True)

        if ranked_rows == 0:
            raise SystemExit("No ranked tracks found for the selected artists.")

        print(f"Writing SQLite: {sqlite_output}", flush=True)
        write_sqlite(con, sqlite_output)

        print(f"Writing JSON index: {json_output}", flush=True)
        write_json_index(con, json_output)
    finally:
        con.close()

    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
