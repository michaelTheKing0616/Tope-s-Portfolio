"""Quality gates run between stages.

Generative steps fail in soft, plausible-looking ways; a gate catches an
incoherent result before the next (expensive) stage builds on it. Each gate
raises QualityError with a specific reason so failures are debuggable.
"""

from __future__ import annotations

from .types import Artifact, QualityError, Script


def check_script(script: Script, min_scenes: int = 2) -> None:
    if len(script.scenes) < min_scenes:
        raise QualityError(f"script has {len(script.scenes)} scenes, need >= {min_scenes}")
    if not script.title.strip():
        raise QualityError("script has an empty title")
    for scene in script.scenes:
        if not scene.narration.strip():
            raise QualityError(f"scene {scene.index} has empty narration")
        if not scene.image_prompt.strip():
            raise QualityError(f"scene {scene.index} has empty image prompt")


def check_audio_coverage(scene_count: int, audio: list[Artifact]) -> None:
    """One narration track per scene, each with a positive duration."""
    if len(audio) != scene_count:
        raise QualityError(f"{len(audio)} audio tracks for {scene_count} scenes")
    for a in audio:
        if int(a.meta.get("duration_ms", 0)) <= 0:
            raise QualityError(f"audio {a.ref} has non-positive duration")


def check_visual_coverage(scene_count: int, images: list[Artifact]) -> None:
    if len(images) != scene_count:
        raise QualityError(f"{len(images)} images for {scene_count} scenes")


def check_video(video: Artifact, scene_count: int) -> None:
    if video.kind != "video":
        raise QualityError(f"expected a video artifact, got {video.kind}")
    if int(video.meta.get("scenes", 0)) != scene_count:
        raise QualityError("assembled video scene count does not match the script")
    if int(video.meta.get("duration_ms", 0)) <= 0:
        raise QualityError("assembled video has non-positive duration")
