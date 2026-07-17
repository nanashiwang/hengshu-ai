"""Regression tests for the current public model catalog shown in the UI."""

from pathlib import Path

from web.server import _model_choices


TEMPLATES = Path(__file__).parents[1] / "web" / "templates"


def test_claude_dropdown_is_current_public_lineup():
    assert [item["id"] for item in _model_choices()] == [
        "claude-fable-5",
        "claude-opus-4-8",
        "claude-sonnet-5",
        "claude-haiku-4-5-20251001",
    ]


def test_frontend_defaults_to_each_provider_current_flagship():
    expected = {
        "index.html": 'value="claude-fable-5"',
        "openai.html": 'value="gpt-5.6-sol"',
        "gemini.html": 'value="gemini-3.5-flash"',
    }
    for filename, marker in expected.items():
        page = (TEMPLATES / filename).read_text(encoding="utf-8")
        assert marker in page


def test_openai_catalog_excludes_non_chat_specialized_variants():
    from relay_detector.protocols.openai import model_choices

    choices = model_choices()
    assert "gpt-5.4-pro" not in choices
    assert "gpt-5.5-pro" not in choices
    assert not any("codex" in model for model in choices)


def test_frontend_copy_does_not_recommend_shut_down_gemini_models():
    page = (TEMPLATES / "gemini.html").read_text(encoding="utf-8")
    assert "gemini-3-pro-preview" not in page
    assert "gemini-3.1-flash-lite-preview" not in page
    assert "gemini-3-flash-preview(2026 stable)" not in page
