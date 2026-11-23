"""Prepare the configured database, seeding only a completely empty installation.

This is a startup helper, not a data reset. Seed notifications are always simulated
in this child process. The separate server process keeps the user's .env settings.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Only this setup subprocess gets simulation providers. Never send seed messages.
os.environ["SMS_PROVIDER"] = "console"
os.environ["AI_PROVIDER"] = "rules"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.db.base import Base, create_schema  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.services.app_settings import ensure_defaults  # noqa: E402


def main() -> None:
    try:
        create_schema(engine)
        with SessionLocal() as db:
            existing = any(
                db.scalar(select(func.count()).select_from(table))
                for table in Base.metadata.sorted_tables if table.name != "settings"
            )
            if existing:
                ensure_defaults(db)
                print("Existing database preserved. Demo seed was not reapplied.")
            else:
                seed(db)
                print("Empty database initialized with demo data. Seed SMS was simulated.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
