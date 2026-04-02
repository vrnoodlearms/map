from __future__ import annotations

import html
import json
import math
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = "https://www.geonames.org/search.html"
QUERY = "National Park/"
PAGE_SIZE = 50
ROOT = Path(__file__).resolve().parent
OUTPUT_JSON = ROOT / "parks-data.json"
OUTPUT_JS = ROOT / "parks-data.js"


def fetch(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            )
        },
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, context=context, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_tags(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " | ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def continent_from_coords(lat: float, lng: float) -> str:
    if lat <= -60:
        return "Antarctica"
    if -35 <= lat <= 37 and -20 <= lng <= 55:
        return "Africa"
    if 35 <= lat <= 82 and -25 <= lng <= 180:
        return "Europe / Asia"
    if -50 <= lat <= 15 and -92 <= lng <= -30:
        return "South America"
    if 7 <= lat <= 84 and -170 <= lng <= -50:
        return "North America"
    if -50 <= lat <= 5 and 110 <= lng <= 180:
        return "Oceania"
    return "Islands / Mixed"


def parse_total_records(page: str) -> int:
    match = re.search(r'(\d[\d,]*) records found for', page)
    if not match:
        raise RuntimeError("Could not find total record count.")
    return int(match.group(1).replace(",", ""))


def parse_rows(page: str) -> list[dict]:
    rows = re.findall(r"<tr(?: class=\"odd\")?>(.*?)</tr>", page, flags=re.S)
    parks: list[dict] = []

    for row in rows:
        if "latitude" not in row or "longitude" not in row:
            continue

        name_match = re.search(
            r'<td><a href="[^"]+">([^<]+)</a>.*?<span class="geo".*?'
            r'<span class="latitude">([^<]+)</span><span class="longitude">([^<]+)</span>',
            row,
            flags=re.S,
        )
        country_match = re.search(
            r'<td><a href="/countries/[^"]+">([^<]+)</a>(.*?)</td><td>',
            row,
            flags=re.S,
        )
        feature_match = re.search(r"</td><td>([^<]+)</td><td nowrap>", row, flags=re.S)

        if not (name_match and country_match and feature_match):
            continue

        name = strip_tags(name_match.group(1))
        lat = float(name_match.group(2))
        lng = float(name_match.group(3))
        country = strip_tags(country_match.group(1))
        locality = strip_tags(country_match.group(2)).strip(", ").replace(" | ", ", ")
        feature_class = strip_tags(feature_match.group(1))

        parks.append(
            {
                "name": name,
                "country": country or "Unknown",
                "locality": locality,
                "featureClass": feature_class,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "continent": continent_from_coords(lat, lng),
            }
        )

    return parks


def dedupe(items: list[dict]) -> list[dict]:
    seen = set()
    output = []
    for item in items:
        key = (
            item["name"].casefold(),
            item["country"].casefold(),
            item["lat"],
            item["lng"],
        )
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def main() -> None:
    first_url = f"{BASE_URL}?q={urllib.parse.quote(QUERY)}"
    first_page = fetch(first_url)
    total_records = parse_total_records(first_page)
    pages = math.ceil(total_records / PAGE_SIZE)

    all_parks = parse_rows(first_page)

    for page_index in range(1, pages):
        start_row = page_index * PAGE_SIZE
        url = f"{BASE_URL}?q={urllib.parse.quote(QUERY)}&startRow={start_row}"
        all_parks.extend(parse_rows(fetch(url)))

    parks = dedupe(all_parks)
    parks.sort(key=lambda park: (park["country"], park["name"]))

    payload = {
        "source": "GeoNames fulltext search for 'National Park/'",
        "generatedFrom": total_records,
        "generatedCount": len(parks),
        "parks": parks,
    }

    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    OUTPUT_JS.write_text(
        "window.WORLD_PARKS = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    print(f"Saved {len(parks)} parks to {OUTPUT_JSON.name} and {OUTPUT_JS.name}")


if __name__ == "__main__":
    main()
