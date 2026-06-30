"""End-to-end and orchestration tests for the Alo pipeline."""

from __future__ import annotations

from alo.pipeline import Pipeline, build_captions, build_pipeline
from alo.providers import StubAssembler, StubImage, StubLLM, StubTTS
from alo.types import Artifact, Scene, Script, TransientError

NO_SLEEP = lambda _seconds: None  # noqa: E731 - keep tests fast & deterministic


def test_runs_end_to_end_and_is_deterministic() -> None:
    a = build_pipeline(sleeper=NO_SLEEP).run("the tortoise and the birds")
    b = build_pipeline(sleeper=NO_SLEEP).run("the tortoise and the birds")
    assert a.success and b.success
    va = a.by_kind("video")[0]
    vb = b.by_kind("video")[0]
    assert va.ref == vb.ref  # same input -> same output


def test_artifact_composition_matches_scene_count() -> None:
    result = build_pipeline(sleeper=NO_SLEEP).run("anansi and the pot of wisdom")
    assert result.success
    scenes = result.by_kind("script")[0].meta["scenes"]
    assert len(result.by_kind("audio")) == scenes
    assert len(result.by_kind("image")) == scenes
    assert len(result.by_kind("video")) == 1
    assert len(result.by_kind("captions")) == 1


class _CountingLLM:
    def __init__(self) -> None:
        self.calls = 0
        self._inner = StubLLM()

    def write_script(self, prompt: str) -> Script:
        self.calls += 1
        return self._inner.write_script(prompt)


def test_cache_prevents_recomputation_within_a_run() -> None:
    # All four scenes share one image prompt template but differ, so visuals are
    # distinct; re-rendering the *same* scene twice would hit the cache. Here we
    # assert the script LLM is called exactly once and cache hits accrue.
    llm = _CountingLLM()
    p = build_pipeline(llm=llm, sleeper=NO_SLEEP)
    p.run("a repeated tale")
    p.run("a repeated tale")  # same prompt -> script cache hit second time
    assert llm.calls == 1
    assert p.cache.hits >= 1


class _FlakyTTS:
    """Raises TransientError the first `fail_times` calls, then succeeds."""

    def __init__(self, fail_times: int) -> None:
        self.fail_times = fail_times
        self.attempts = 0
        self._inner = StubTTS()

    def synthesize(self, text: str, voice: str) -> Artifact:
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise TransientError("tts hiccup")
        return self._inner.synthesize(text, voice)


def test_retries_transient_failures_then_succeeds() -> None:
    tts = _FlakyTTS(fail_times=2)
    p = build_pipeline(tts=tts, sleeper=NO_SLEEP, max_attempts=3)
    result = p.run("a tale that survives flakiness")
    assert result.success
    # First scene: 2 failures + 1 success = 3 attempts on the first synthesize.
    assert tts.attempts >= 3
    assert any(e["name"] == "voice:retry" for e in result.trace)


def test_gives_up_after_max_attempts() -> None:
    tts = _FlakyTTS(fail_times=99)
    p = build_pipeline(tts=tts, sleeper=NO_SLEEP, max_attempts=3)
    result = p.run("a doomed tale")
    assert not result.success
    assert "TransientError" in (result.error or "")
    assert any(e["name"] == "voice:gave_up" for e in result.trace)


class _BadLLM:
    def write_script(self, prompt: str) -> Script:
        return Script(title="too short", scenes=(Scene(0, "only one", "img"),))


def test_quality_gate_rejects_thin_script() -> None:
    p = build_pipeline(llm=_BadLLM(), sleeper=NO_SLEEP)
    result = p.run("anything")
    assert not result.success
    assert "QualityError" in (result.error or "")


def test_captions_are_timed_sequentially() -> None:
    script = Script(
        title="t",
        scenes=(Scene(0, "first", "i0"), Scene(1, "second", "i1")),
    )
    audio = [
        Artifact("audio", "a0", {"duration_ms": 1000}),
        Artifact("audio", "a1", {"duration_ms": 2000}),
    ]
    srt = build_captions(script, audio)
    assert "00:00:00,000 --> 00:00:01,000" in srt
    assert "00:00:01,000 --> 00:00:03,000" in srt
