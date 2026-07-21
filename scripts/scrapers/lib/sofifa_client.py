"""Shared SoFIFA browser client — Cloudflare requires SeleniumBase."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup

SOFIFA_BASE = "https://sofifa.com"
OVERRIDES_PATH = Path(__file__).resolve().parents[1] / "data" / "sofifa-id-overrides.json"


def load_sofifa_overrides() -> dict[str, int]:
    """TM / Sportverse id → SoFIFA player id."""
    overrides: dict[str, int] = {
        "33357": 168609,
        "tm-33357": 168609,
    }
    if OVERRIDES_PATH.exists():
        raw = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
        for key, val in (raw.get("tm") or {}).items():
            overrides[str(key)] = int(val)
            overrides[str(key).replace("tm-", "")] = int(val)
        for key, val in (raw.get("sportverse_id") or {}).items():
            overrides[str(key)] = int(val)
    return overrides


def load_search_term_overrides() -> dict[str, list[str]]:
    if not OVERRIDES_PATH.exists():
        return {}
    raw = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    return {str(k): list(v) for k, v in (raw.get("search_terms") or {}).items()}


def normalize_search_text(text: str) -> str:
    import unicodedata

    out = unicodedata.normalize("NFD", text or "")
    out = "".join(c for c in out if unicodedata.category(c) != "Mn")
    return out.strip()


def search_query_variants(name: str, extra: list[str] | None = None) -> list[str]:
    variants: list[str] = []
    for candidate in [name, normalize_search_text(name), *(extra or [])]:
        c = (candidate or "").strip()
        if c and c not in variants:
            variants.append(c)
    parts = normalize_search_text(name).split()
    if len(parts) >= 2:
        last = parts[-1]
        if last not in variants:
            variants.append(last)
        full = " ".join(parts)
        if full not in variants:
            variants.append(full)
    return variants


class SofifaBrowserClient:
    """Undetected Chrome via SeleniumBase."""

    def __init__(self, sleep: float = 2.0, headless: bool = True):
        self.sleep = sleep
        self.headless = headless
        self._sb = None
        self._ctx = None

    def __enter__(self) -> SofifaBrowserClient:
        from seleniumbase import SB

        self._ctx = SB(uc=True, headless=self.headless)
        self._sb = self._ctx.__enter__()
        return self

    def __exit__(self, *args: Any) -> None:
        if self._ctx:
            self._ctx.__exit__(*args)

    def warm_up(self) -> None:
        """Prime Cloudflare session before the scrape queue."""
        self.get_soup("/")

    def _is_cloudflare_page(self, html: str, title: str) -> bool:
        t = (title or "").lower()
        h = (html or "").lower()
        return "just a moment" in t or "challenge-platform" in h or "security verification" in h

    def _wait_past_cloudflare(self, timeout: float = 60.0) -> None:
        assert self._sb is not None
        deadline = time.time() + timeout
        while time.time() < deadline:
            title = self._sb.get_title() or ""
            html = self._sb.get_page_source() or ""
            if not self._is_cloudflare_page(html, title):
                return
            time.sleep(1.5)
        raise RuntimeError(
            "Cloudflare challenge did not clear. Complete the captcha in the browser, "
            "or run: python3 scripts/scrapers/sofifa_live_bulk.py --offline"
        )

    def get_soup(self, path: str) -> BeautifulSoup:
        assert self._sb is not None
        url = path if path.startswith("http") else urljoin(SOFIFA_BASE, path)
        time.sleep(self.sleep)
        self._sb.open(url)
        self._wait_past_cloudflare()
        html = self._sb.get_page_source() or ""
        title = self._sb.get_title() or ""
        soup = BeautifulSoup(html, "html.parser")
        h1 = soup.select_one("h1")
        name = h1.get_text(strip=True) if h1 else ""
        if self._is_cloudflare_page(html, title) or name.lower() in ("", "sofifa.com"):
            raise RuntimeError(f"SoFIFA page blocked or empty for {url}")
        return soup

    def search_players(self, keyword: str) -> list[dict[str, Any]]:
        soup = self.get_soup(f"/players?keyword={quote_plus(keyword)}")
        rows = parse_search_rows(soup)
        if not rows:
            logger = __import__("logging").getLogger("sofifa")
            logger.debug("Search %r returned 0 rows (title=%s)", keyword, soup.title.string if soup.title else "")
        return rows

    def search_players_multi(self, queries: list[str]) -> list[dict[str, Any]]:
        seen: set[int] = set()
        merged: list[dict[str, Any]] = []
        for q in queries:
            for row in self.search_players(q):
                pid = row["sofifa_id"]
                if pid in seen:
                    continue
                seen.add(pid)
                merged.append(row)
            if merged:
                break
        return merged

    def player_versions(self, player_id: int) -> list[dict[str, Any]]:
        soup = self.get_soup(f"/player/{player_id}/")
        versions = []
        for a in soup.select("select option, a[href*='/player/']"):
            href = a.get("href") or a.get("value") or ""
            m = re.search(rf"/player/{player_id}/(\d+)/", href)
            if not m:
                continue
            version_id = int(m.group(1))
            label = a.get_text(strip=True)
            versions.append(
                {"version_id": version_id, "label": label, "path": f"/player/{player_id}/{version_id}/"}
            )
        seen: set[int] = set()
        uniq = []
        for v in versions:
            if v["version_id"] in seen:
                continue
            seen.add(v["version_id"])
            uniq.append(v)
        if not uniq:
            uniq.append({"version_id": 0, "label": "current", "path": f"/player/{player_id}/"})
        return uniq

    def parse_player_page(self, path: str) -> dict[str, Any]:
        soup = self.get_soup(path)
        profile: dict[str, Any] = {"path": path}

        h1 = soup.select_one("h1")
        profile["name"] = h1.get_text(strip=True) if h1 else ""

        for block in soup.select("p"):
            text = block.get_text(" ", strip=True)
            if "Overall rating" in text:
                m = re.search(r"Overall rating\s+(\d+)", text)
                if m:
                    profile["overall"] = int(m.group(1))
            if "Potential" in text:
                m = re.search(r"Potential\s+(\d+)", text)
                if m:
                    profile["potential"] = int(m.group(1))

        attrs: dict[str, int] = {}
        for col in soup.select("div.col"):
            title = col.select_one("h5")
            if not title:
                continue
            for span in col.select("span"):
                parts = span.get_text(" ", strip=True).split()
                if len(parts) >= 2 and parts[-1].isdigit():
                    attrs[parts[0].lower()] = int(parts[-1])
            for li in col.select("li"):
                t = li.get_text(" ", strip=True)
                m = re.match(r"^(.+?)\s+(\d+)\s*$", t)
                if m:
                    key = m.group(1).strip().lower().replace(" ", "_")
                    attrs[key] = int(m.group(2))
        profile["attributes"] = attrs

        for p in soup.select("div.info div"):
            label = p.select_one("label")
            if not label:
                continue
            key = label.get_text(strip=True).lower().replace(" ", "_")
            val = p.get_text(" ", strip=True).replace(label.get_text(strip=True), "").strip()
            profile[key] = val

        title = soup.title.string if soup.title else ""
        m = re.search(r"FIFA (\d+)", title or "")
        if m:
            profile["fifa_edition"] = m.group(1)
        return profile


def parse_search_rows(soup: BeautifulSoup) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[int] = set()

    def add_row(sofifa_id: int, name: str, **extra: Any) -> None:
        if sofifa_id in seen:
            return
        seen.add(sofifa_id)
        rows.append({"sofifa_id": sofifa_id, "name": name, **extra})

    for tr in soup.select("table.table tbody tr, table tbody tr"):
        link = tr.select_one("a[href*='/player/']")
        if not link:
            continue
        href = link.get("href", "")
        m = re.search(r"/player/(\d+)/", href)
        if not m:
            continue
        cols = [td.get_text(strip=True) for td in tr.find_all("td")]
        add_row(
            int(m.group(1)),
            link.get_text(strip=True),
            positions=cols[2] if len(cols) > 2 else "",
            overall=_safe_int(cols[3]) if len(cols) > 3 else None,
            team=cols[4] if len(cols) > 4 else "",
        )

    if not rows:
        for link in soup.select("a[href*='/player/']"):
            href = link.get("href", "")
            m = re.search(r"/player/(\d+)/", href)
            if not m:
                continue
            add_row(int(m.group(1)), link.get_text(strip=True))

    return rows


def _safe_int(v: Any) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def pick_search_hit(
    hits: list[dict[str, Any]],
    *,
    name: str,
    nationality: str = "",
    club_hint: str = "",
) -> dict[str, Any] | None:
    if not hits:
        return None
    if len(hits) == 1:
        return hits[0]

    nat = nationality.lower().split()[0] if nationality else ""
    if nat:
        nat_hits = [h for h in hits if nat in (h.get("team") or "").lower() or nat in (h.get("name") or "").lower()]
        if len(nat_hits) == 1:
            return nat_hits[0]
        if nat_hits:
            hits = nat_hits

    if club_hint:
        club = club_hint.lower()
        club_hits = [h for h in hits if club in (h.get("team") or "").lower()]
        if len(club_hits) == 1:
            return club_hits[0]
        if club_hits:
            hits = club_hits

    target = name.lower().split()[-1] if name else ""
    if target:
        last_hits = [h for h in hits if target in (h.get("name") or "").lower()]
        if last_hits:
            return last_hits[0]

    return hits[0]


def harvest_player_live(
    client: SofifaBrowserClient,
    player_id: int,
    *,
    editions: str = "last",
) -> dict[str, Any]:
    """Scrape one player. editions: 'last' (1 page) or 'all' (every FIFA version)."""
    versions = client.player_versions(player_id)
    if editions == "all":
        paths = versions
    else:
        paths = [versions[-1] if versions else {"version_id": 0, "label": "current", "path": f"/player/{player_id}/"}]

    history = []
    for v in paths:
        try:
            row = client.parse_player_page(v["path"])
            row["version_id"] = v["version_id"]
            row["version_label"] = v["label"]
            history.append(row)
        except Exception:
            continue

    peak = max((h.get("overall") or 0 for h in history), default=0)
    if peak <= 0:
        raise RuntimeError(f"No overall rating parsed for SoFIFA player {player_id}")
    return {
        "sofifa_id": player_id,
        "peak_overall": peak,
        "editions": history,
        "edition_count": len(versions),
        "source": "sofifa_live",
    }
