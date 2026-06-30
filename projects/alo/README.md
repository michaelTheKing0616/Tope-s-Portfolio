# Alo

> *"Alo o!"* — the call that opens a Yoruba folktale.

Alo turns a one-line prompt into a narrated, captioned short video of an African
folktale. The point of the project is **orchestration**, not any single model
call: a multi-stage generative pipeline with caching, retries, quality gates and
tracing — the "beyond a single API call" creative-AI competence.

## Run (offline, no API keys)

```bash
python -m alo.cli "the tortoise and the birds"
python -m pytest          # tests
```

Every external service is behind a Protocol with a **deterministic stub**, so the
whole pipeline runs and tests offline. Swap in real providers (OpenAI for script,
ElevenLabs for voice, an image model, FFmpeg for assembly) by implementing the
Protocols in `providers.py` — the orchestrator does not change.

## Pipeline

```
prompt
  │
  ▼  script stage   (LLM)        ─ quality gate: >=2 scenes, non-empty narration
  ▼  voice stage    (TTS)        ─ quality gate: one track/scene, positive duration
  ▼  visual stage   (image)      ─ quality gate: one image/scene
  ▼  assemble stage (FFmpeg)     ─ quality gate: scene count + duration match
  ▼
PipelineResult { artifacts, trace, success }
```

Each stage is:

- **Retriable** — `TransientError`s are retried with exponential backoff (a real
  `sleeper` in production, a no-op in tests); after `max_attempts` it gives up and
  the failure is traced.
- **Cached** — keyed by a content hash (`cache.py`), so a retry of a later stage
  never recomputes an earlier one. The CLI prints cache hit/miss counts.
- **Gated** — `quality.py` catches incoherent output (e.g. audio that doesn't
  cover every scene) before the next stage builds on it.
- **Traced** — `observability.py` records every span, retry and cache hit.

A failure anywhere degrades to a structured `PipelineResult(success=False, error,
trace)` rather than throwing into the caller.

## Where the senior signal is

A real generative *system*: independent retriable stages, content-addressed
caching, explicit quality gates and full tracing. That orchestration discipline —
not prompt cleverness — is what makes generative-AI work dependable.

## Tests

`python -m pytest` covers end-to-end success and determinism, artifact
composition, cache reuse, retry-then-succeed, give-up-after-max-attempts,
quality-gate rejection, and sequential caption timing.
