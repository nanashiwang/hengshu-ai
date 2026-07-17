"""pytest setup that runs before test module imports.

web/jobs.py creates JOBS_DIR at import time. In production this is
/opt/suyuan-detector/web_data/jobs (service-owned), which a developer laptop or CI
container can't write to. We override the path with a per-session temp
dir so the import doesn't fail.
"""

from __future__ import annotations

import os
import tempfile

os.environ.setdefault(
    "SUYUAN_JOBS_DIR",
    tempfile.mkdtemp(prefix="suyuan-test-jobs-"),
)
os.environ.setdefault(
    "SUYUAN_WISHLIST_PATH",
    tempfile.mkstemp(prefix="suyuan-test-wishlist-")[1],
)
