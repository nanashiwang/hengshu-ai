from __future__ import annotations

import importlib

import web.brand as brand_module


def test_suyuan_brand_environment_configures_public_site(monkeypatch):
    with monkeypatch.context() as env:
        env.setenv("SUYUAN_SITE_URL", "https://suyuan.example")
        reloaded = importlib.reload(brand_module)
        assert reloaded.brand.name == "溯源"
        assert reloaded.brand.site_url == "https://suyuan.example"
    importlib.reload(brand_module)
