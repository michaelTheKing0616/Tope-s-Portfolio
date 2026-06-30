from __future__ import annotations

from alo.providers import StubAssembler, StubImage, StubLLM, StubTTS


def test_llm_produces_a_structured_multi_scene_script() -> None:
    script = StubLLM().write_script("the clever tortoise")
    assert len(script.scenes) >= 2
    assert all(s.narration and s.image_prompt for s in script.scenes)
    assert script.title.startswith("The clever tortoise")


def test_tts_duration_scales_with_word_count() -> None:
    tts = StubTTS()
    short = tts.synthesize("one two", "v")
    long = tts.synthesize("one two three four five six", "v")
    assert long.meta["duration_ms"] > short.meta["duration_ms"]


def test_stubs_are_deterministic() -> None:
    assert StubTTS().synthesize("hello", "v").ref == StubTTS().synthesize("hello", "v").ref
    assert StubImage().render("a dawn shot").ref == StubImage().render("a dawn shot").ref


def test_assembler_totals_scene_durations() -> None:
    from alo.types import Artifact

    audio = [Artifact("audio", "a0", {"duration_ms": 1500}), Artifact("audio", "a1", {"duration_ms": 2500})]
    images = [Artifact("image", "i0"), Artifact("image", "i1")]
    video = StubAssembler().assemble(audio, images, "captions")
    assert video.meta["duration_ms"] == 4000
    assert video.meta["scenes"] == 2
