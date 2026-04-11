"""
migrate_db.py
──────────────
Adds new columns to the documents table using SQLite ALTER TABLE.
Safe to run multiple times.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "documents.db")

MIGRATIONS = [
    ("doc_type", "VARCHAR(30) DEFAULT 'unknown'"),
    ("extracted_metadata", "TEXT DEFAULT '{}'"),
    ("ocr_layout_data", "TEXT DEFAULT '[]'"),
]


def migrate():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Check existing columns
        cursor.execute("PRAGMA table_info(documents)")
        existing = {row[1] for row in cursor.fetchall()}

        for col_name, col_def in MIGRATIONS:
            if col_name not in existing:
                cursor.execute(f"ALTER TABLE documents ADD COLUMN {col_name} {col_def}")
                print(f"✓ Added column: {col_name}")
            else:
                print(f"⚠ Column {col_name} already exists — skipped")

        conn.commit()
        print("✓ Migration complete")


if __name__ == "__main__":
    migrate()
