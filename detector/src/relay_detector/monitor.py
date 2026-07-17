"""Cron/systemd-safe helpers for one-shot scheduled relay monitoring."""

from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from .core.models import Protocol


_TARGET_ID_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$")
_ENV_NAME_RE = re.compile(r"^[A-Z_][A-Z0-9_]{0,127}$")


def normalize_target_id(value: str) -> str:
    target_id = value.strip().lower()
    if not _TARGET_ID_RE.fullmatch(target_id):
        raise ValueError(
            "monitor target id must be 1-64 ASCII letters, digits, '.', '_' or '-', "
            "and must start/end with a letter or digit"
        )
    return target_id


def resolve_monitor_api_key(api_key_env: str | None = None) -> str:
    """Read a monitor key without accepting it as a command-line argument.

    systemd deployments should use LoadCredential=api_key. Local/cron users
    may instead point at an existing environment variable by name. The target
    config therefore contains only a reference, never the secret itself.
    """
    credentials_dir = os.environ.get("CREDENTIALS_DIRECTORY", "").strip()
    if credentials_dir:
        credential = Path(credentials_dir) / "api_key"
        try:
            value = credential.read_text(encoding="utf-8").strip()
        except OSError as error:
            raise RuntimeError(f"cannot read systemd api_key credential: {error}") from error
        if value:
            return value
        raise RuntimeError("systemd api_key credential is empty")

    env_name = (api_key_env or "").strip()
    if not env_name:
        raise RuntimeError(
            "monitor API key unavailable: configure systemd LoadCredential=api_key "
            "or set --api-key-env to an environment variable name"
        )
    if not _ENV_NAME_RE.fullmatch(env_name):
        raise ValueError("api-key-env is not a valid environment variable name")
    value = os.environ.get(env_name, "").strip()
    if not value:
        raise RuntimeError(f"monitor API key environment variable {env_name} is empty")
    return value


def monitor_output_path(
    root: Path,
    protocol: Protocol,
    target_id: str,
    *,
    now: datetime | None = None,
    nonce: str | None = None,
) -> Path:
    """Return a collision-resistant report path consumed by leaderboard.py."""
    safe_id = normalize_target_id(target_id)
    observed_at = now or datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    stamp = observed_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    suffix = nonce or secrets.token_hex(4)
    if not re.fullmatch(r"[a-f0-9]{8}", suffix):
        raise ValueError("monitor report nonce must be exactly 8 lowercase hex characters")
    # jobs.py and /r/{job_id} share one public identifier contract:
    # [A-Za-z0-9_-]{8,64}. Keep enough target context for operators while the
    # timestamp+nonce guarantee uniqueness after truncation.
    filename_id = safe_id.replace(".", "_")[:24].strip("_-") or "target"
    job_id = f"monitor-{filename_id}-{stamp}-{suffix}"
    if len(job_id) > 64 or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", job_id):
        raise AssertionError("generated monitor job id violates the public report contract")
    return root.resolve() / protocol.value / f"{job_id}.json"
