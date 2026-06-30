from __future__ import annotations

import pytest

from alo import quality
from alo.types import Artifact, QualityError, Scene, Script


def _script(n: int) -> Script:
    return Script(title="ok", scenes=tuple(Scene(i, f"narration {i}", f"img {i}") for i in range(n)))


def test_check_script_accepts_a_healthy_script() -> None:
    quality.check_script(_script(4))  # should not raise


def test_check_script_rejects_too_few_scenes() -> None:
    with pytest.raises(QualityError):
        quality.check_script(_script(1))


def test_check_script_rejects_empty_narration() -> None:
    bad = Script(title="t", scenes=(Scene(0, "  ", "img"), Scene(1, "ok", "img")))
    with pytest.raises(QualityError):
        quality.check_script(bad)


def test_audio_coverage_requires_one_track_per_scene() -> None:
    with pytest.raises(QualityError):
        quality.check_audio_coverage(2, [Artifact("audio", "a", {"duration_ms": 100})])


def test_audio_coverage_rejects_zero_duration() -> None:
    audio = [Artifact("audio", "a", {"duration_ms": 0})]
    with pytest.raises(QualityError):
        quality.check_audio_coverage(1, audio)


def test_video_scene_count_must_match() -> None:
    vid = Artifact("video", "v", {"scenes": 3, "duration_ms": 1000})
    with pytest.raises(QualityError):
        quality.check_video(vid, 4)
