"""Runtime settings for deployment modes."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str | None, default: List[str]) -> List[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_mode: str
    cors_origins: List[str]
    enable_api_docs: bool
    admin_api_key: str | None
    rate_limit_per_minute: int

    @property
    def is_public(self) -> bool:
        return self.app_mode == "public"


def load_settings() -> Settings:
    app_mode = os.getenv("APP_MODE", "admin").strip().lower()
    if app_mode not in {"admin", "public"}:
        app_mode = "admin"

    is_public = app_mode == "public"
    default_origins = (
        ["http://localhost:3000", "http://localhost:5173"]
        if not is_public
        else []
    )
    default_docs = not is_public

    raw_rate_limit = os.getenv("RATE_LIMIT_PER_MINUTE", "120")
    try:
        rate_limit_per_minute = max(10, int(raw_rate_limit))
    except ValueError:
        rate_limit_per_minute = 120

    return Settings(
        app_mode=app_mode,
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS"), default_origins),
        enable_api_docs=_as_bool(os.getenv("ENABLE_API_DOCS"), default_docs),
        admin_api_key=(os.getenv("ADMIN_API_KEY") or "").strip() or None,
        rate_limit_per_minute=rate_limit_per_minute,
    )


settings = load_settings()
