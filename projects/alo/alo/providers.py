"""External-service boundaries and their deterministic local stubs.

Each provider is a Protocol so a real implementation (OpenAI, ElevenLabs, an
image model, FFmpeg) can be dropped in without changing the orchestrator. The
stubs are deterministic: the same input always yields the same output, which is
what makes the pipeline reproducible and the tests stable.
"""

from __future__ import annotations

import hashlib
from typing import Protocol

from .types import Artifact, Scene, Script

WORD_MS = 380  # approximate narration pace, ms per word


def _hash(*parts: str) -> str:
    return hashlib.sha256("\u0001".join(parts).encode("utf-8")).hexdigest()[:12]


class LLMProvider(Protocol):
    def write_script(self, prompt: str) -> Script: ...


class TTSProvider(Protocol):
    def synthesize(self, text: str, voice: str) -> Artifact: ...


class ImageProvider(Protocol):
    def render(self, prompt: str) -> Artifact: ...


class VideoAssembler(Protocol):
    def assemble(self, audio: list[Artifact], images: list[Artifact], captions: str) -> Artifact: ...


# --- deterministic stubs --------------------------------------------------

# A fixed four-beat folktale structure keeps stub output coherent and testable.
_BEATS = [
    ("The world before", "A wide, warm establishing shot of {subject} at dawn."),
    ("The trouble arrives", "{subject} faces a sudden, vivid problem under a darkening sky."),
    ("The turning", "A clever, hopeful turn — {subject} acts with wit and courage."),
    ("The lesson", "A calm closing tableau; the moral of {subject} settles in."),
]


class StubLLM:
    """Turns a prompt into a structured four-scene folktale, deterministically."""

    def write_script(self, prompt: str) -> Script:
        subject = prompt.strip().rstrip(".") or "the tortoise and the birds"
        title = subject[:1].upper() + subject[1:]
        scenes = tuple(
            Scene(
                index=i,
                narration=f"{beat}. {subject} — scene {i + 1} of the tale, told the old way.",
                image_prompt=img.format(subject=subject),
            )
            for i, (beat, img) in enumerate(_BEATS)
        )
        return Script(title=title, scenes=scenes)


class StubTTS:
    """Fakes narration: duration scales with word count; ref is content-addressed."""

    def synthesize(self, text: str, voice: str) -> Artifact:
        words = max(1, len(text.split()))
        return Artifact(
            kind="audio",
            ref=f"audio://{_hash(voice, text)}.wav",
            meta={"voice": voice, "words": words, "duration_ms": words * WORD_MS},
        )


class StubImage:
    def render(self, prompt: str) -> Artifact:
        return Artifact(kind="image", ref=f"image://{_hash(prompt)}.png", meta={"w": 1280, "h": 720})


class StubAssembler:
    """Composes a final 'video' artifact and reports the total duration."""

    def assemble(self, audio: list[Artifact], images: list[Artifact], captions: str) -> Artifact:
        total = sum(int(a.meta.get("duration_ms", 0)) for a in audio)
        digest = _hash(*[a.ref for a in audio], *[i.ref for i in images], captions)
        return Artifact(
            kind="video",
            ref=f"video://{digest}.mp4",
            meta={"duration_ms": total, "scenes": len(images)},
        )
