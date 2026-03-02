#!/usr/bin/env python3
"""store_completed.py — Ingest completed OmniFocus tasks into tracking.db.

Reads JSON from stdin (output of collect_completed.js) and upserts into
the completed_tasks table. Idempotent: uses INSERT OR IGNORE on unique
omnifocus_id, so re-runs are safe.

Usage:
    osascript -l JavaScript collect_completed.js 1 | python3 store_completed.py [--date YYYY-MM-DD]

Exit codes:
    0 = success
    1 = error (printed to stderr)
"""

import json
import sqlite3
import sys
import os
from datetime import date, datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "tracking.db")
DB_PATH = os.path.normpath(DB_PATH)


def main():
    # Parse args
    collected_date = date.today().isoformat()
    if "--date" in sys.argv:
        idx = sys.argv.index("--date")
        if idx + 1 < len(sys.argv):
            collected_date = sys.argv[idx + 1]
            # Validate date format
            try:
                datetime.strptime(collected_date, "%Y-%m-%d")
            except ValueError:
                print(f"Error: invalid date format '{collected_date}', expected YYYY-MM-DD", file=sys.stderr)
                sys.exit(1)

    # Read JSON from stdin
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"ok": True, "inserted": 0, "skipped": 0, "total_input": 0}))
            return
        tasks = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Error: invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(tasks, list):
        print("Error: expected JSON array", file=sys.stderr)
        sys.exit(1)

    # Connect with WAL mode for safety
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")

    inserted = 0
    skipped = 0

    try:
        with conn:
            for t in tasks:
                try:
                    cur = conn.execute(
                        """INSERT OR IGNORE INTO completed_tasks
                           (omnifocus_id, name, completion_date, project, tags,
                            estimated_minutes, spoon_cost, priority, rigidity, collected_date)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            t["omnifocus_id"],
                            t["name"],
                            t["completion_date"],
                            t.get("project"),
                            t.get("tags"),
                            t.get("estimated_minutes"),
                            t.get("spoon_cost"),
                            t.get("priority"),
                            t.get("rigidity"),
                            collected_date,
                        ),
                    )
                    if cur.rowcount > 0:
                        inserted += 1
                    else:
                        skipped += 1
                except sqlite3.Error as e:
                    print(f"Warning: skipped task '{t.get('name', '?')}': {e}", file=sys.stderr)
                    skipped += 1
    finally:
        conn.close()

    print(json.dumps({
        "ok": True,
        "inserted": inserted,
        "skipped": skipped,
        "total_input": len(tasks),
        "collected_date": collected_date,
    }))


if __name__ == "__main__":
    main()
