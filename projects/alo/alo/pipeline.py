"""The Alo orchestrator: prompt -> script -> voice -> visuals -> assembly.

The pipeline is the point, not any single model call. Stages are:
  * independent and **retriable** with exponential backoff (transient failures),
  * **cached** by a content hash so a retry never recomputes good work,
  * separated by **quality gates** so an incoherent result is caught early,
  * **traced** end to end.
A failure degrades to a structured PipelineResult (success=False, error, and the
partial trace) rather than raising into the caller.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, TypeVar

from . import quality
from .cache import MemoryCache, key_for
from .observability import Tracer
from .providers import (
    ImageProvider,
    LLMProvider,
    StubAssembler,
    StubImage,
    StubLLM,
    StubTTS,
    TTSProvider,
    VideoAssembler,
)
from .types import Artifact, PipelineResult, QualityError, Script, TransientError

T = TypeVar("T")


def _ts(ms: int) -> str:
    hh, rem = divmod(ms, 3_600_000)
    mm, rem = divmod(rem, 60_000)
    ss, mmm = divmod(rem, 1000)
    return f"{hh:02}:{mm:02}:{ss:02},{mmm:03}"


def build_captions(script: Script, audio: list[Artifact]) -> str:
    """A simple SRT track timed sequentially from each scene's audio duration."""
    out: list[str] = []
    cursor = 0
    for i, (scene, track) in enumerate(zip(script.scenes, audio), start=1):
        dur = int(track.meta.get("duration_ms", 0))
        start, end = cursor, cursor + dur
        cursor = end
        out.append(f"{i}\n{_ts(start)} --> {_ts(end)}\n{scene.narration}\n")
    return "\n".join(out)


@dataclass
class Pipeline:
    llm: LLMProvider
    tts: TTSProvider
    image: ImageProvider
    assembler: VideoAssembler
    cache: MemoryCache = field(default_factory=MemoryCache)
    tracer: Tracer = field(default_factory=Tracer)
    sleeper: Callable[[float], None] = time.sleep
    max_attempts: int = 3
    backoff_base: float = 0.05
    voice: str = "narrator-warm"

    # --- retry + cache helpers -------------------------------------------
    def _with_retry(self, label: str, fn: Callable[[], T]) -> T:
        attempt = 0
        while True:
            attempt += 1
            try:
                with self.tracer.span(label, {"attempt": attempt}):
                    return fn()
            except TransientError as exc:
                if attempt >= self.max_attempts:
                    self.tracer.note(f"{label}:gave_up", attempts=attempt, error=str(exc))
                    raise
                self.tracer.note(f"{label}:retry", attempt=attempt, error=str(exc))
                self.sleeper(self.backoff_base * (2 ** (attempt - 1)))

    def _cached(self, stage: str, key_payload: object, compute: Callable[[], T]) -> T:
        key = key_for(stage, key_payload)
        hit = self.cache.get(key)
        if hit is not None:
            self.tracer.note(f"{stage}:cache_hit", key=key)
            return hit  # type: ignore[return-value]
        value = self._with_retry(stage, compute)
        self.cache.set(key, value)
        return value

    # --- public entry point ----------------------------------------------
    def run(self, prompt: str) -> PipelineResult:
        title = ""
        artifacts: list[Artifact] = []
        try:
            script = self._cached("script", prompt, lambda: self.llm.write_script(prompt))
            title = script.title
            quality.check_script(script)
            artifacts.append(
                Artifact("script", f"script://{title}", {"scenes": len(script.scenes)})
            )

            audio = [
                self._cached("voice", (self.voice, s.narration), lambda s=s: self.tts.synthesize(s.narration, self.voice))
                for s in script.scenes
            ]
            quality.check_audio_coverage(len(script.scenes), audio)
            artifacts.extend(audio)

            images = [
                self._cached("visual", s.image_prompt, lambda s=s: self.image.render(s.image_prompt))
                for s in script.scenes
            ]
            quality.check_visual_coverage(len(script.scenes), images)
            artifacts.extend(images)

            captions = build_captions(script, audio)
            artifacts.append(Artifact("captions", "captions://srt", {"length": len(captions)}))

            video = self._cached(
                "assemble",
                [a.ref for a in audio] + [i.ref for i in images],
                lambda: self.assembler.assemble(audio, images, captions),
            )
            quality.check_video(video, len(script.scenes))
            artifacts.append(video)

            return PipelineResult(title=title, artifacts=artifacts, trace=self.tracer.events, success=True)

        except (QualityError, TransientError, ValueError) as exc:
            return PipelineResult(
                title=title,
                artifacts=artifacts,
                trace=self.tracer.events,
                success=False,
                error=f"{type(exc).__name__}: {exc}",
            )


def build_pipeline(**overrides: object) -> Pipeline:
    """A ready-to-run pipeline backed by the deterministic offline stubs."""
    base: dict[str, object] = dict(
        llm=StubLLM(), tts=StubTTS(), image=StubImage(), assembler=StubAssembler()
    )
    base.update(overrides)
    return Pipeline(**base)  # type: ignore[arg-type]
