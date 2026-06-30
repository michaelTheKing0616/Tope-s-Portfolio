"""Alo - an AI pipeline that retells African folktales as narrated short videos.

The package is dependency-free and runs fully offline: every external service
(LLM, TTS, image generation, video assembly) sits behind a small Protocol with a
deterministic local stub, so the whole pipeline can be run and tested with
nothing but a Python 3.10+ interpreter. Swap in real providers via env without
touching the orchestration.
"""

from .pipeline import Pipeline, build_pipeline
from .types import Artifact, PipelineResult, Scene, Script

__all__ = ["Pipeline", "build_pipeline", "Artifact", "PipelineResult", "Scene", "Script"]
