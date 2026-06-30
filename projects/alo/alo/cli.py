"""Command-line entry point: `python -m alo.cli "the tortoise and the birds"`.

Runs the offline pipeline and prints the trajectory (stages, retries, cache
hits) plus the resulting artifact manifest. No API keys required.
"""

from __future__ import annotations

import sys

from .pipeline import build_pipeline


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    prompt = " ".join(args) if args else "the tortoise and the birds"

    pipeline = build_pipeline()
    result = pipeline.run(prompt)

    print(f"\nAlo o!  \u2014  {result.title}\n" + "-" * 48)
    for ev in result.trace:
        meta = ev.get("meta", {})
        detail = " ".join(f"{k}={v}" for k, v in meta.items())
        print(f"  [{ev['ms']:>6.1f}ms] {ev['name']:<18} {detail}")

    print("\nArtifacts")
    for art in result.artifacts:
        extra = " ".join(f"{k}={v}" for k, v in art.meta.items())
        print(f"  - {art.kind:<8} {art.ref}  {extra}")

    cache = pipeline.cache
    print(f"\ncache: {cache.hits} hit / {cache.misses} miss")
    if result.success:
        video = result.by_kind("video")[0]
        print(f"status: OK  \u00b7  {int(video.meta['duration_ms']) / 1000:.1f}s across {video.meta['scenes']} scenes")
        return 0
    print(f"status: FAILED  \u00b7  {result.error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
