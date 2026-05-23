# -*- coding: utf-8 -*-
"""
Batch-analyze Nanjing booking captcha screenshots on the local machine.

This is a fast approximation of the OpenAutoJS solver logic. It is intended for
threshold tuning and regression statistics; final acceptance should still use the
in-app replay script because Android images/colors behavior can differ slightly.
"""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path
from typing import Any, Callable

from PIL import Image


DEFAULT_PROFILE = {
    "mathProfile": {
        "expressionRegion": {"x": 505, "y": 1162, "w": 463, "h": 206},
    },
    "sliderProfile": {
        "imageSearchRegion": {"x": 183, "y": 940, "w": 1079, "h": 693},
        "handleRegion": {"x": 196, "y": 1702, "w": 143, "h": 131},
        "trackRegion": {"x": 384, "y": 1691, "w": 757, "h": 140},
    },
}

CFG = {
    "trackMinRatio": 0.12,
    "arrowMinRatio": 0.08,
    "arrowStrongMinRatio": 0.08,
    "fastTypeProbeStep": 12,
    "fastImageScanStep": 14,
    "trackPresenceMinRatio": 0.006,
    "trackPresenceMinHits": 3,
    "handlePresenceMinRatio": 0.045,
    "handlePresenceMinHits": 4,
    "handleConfirmMinRatio": 0.065,
    "imageProbeMinRatio": 0.004,
    "pollutedImageMinRatio": 0.35,
    "pollutedFallbackStep": 8,
    "pollutedBrightColumnStrongRatio": 0.48,
    "pollutedBrightColumnMinRatio": 0.28,
    "pollutedBrightMaxCenterRatio": 0.72,
    "pollutedEdgeStep": 12,
    "pollutedFallbackMinScore": 70,
    "pollutedFallbackMinNeutralRatio": 0.68,
    "pollutedFallbackMaxDarkRatio": 0.22,
    "pollutedFallbackMinCenterRatio": 0.25,
    "fastImageMinColumnHits": 3,
    "grayMin": 165,
    "grayMax": 245,
    "grayChromaMax": 24,
    "scanStep": 6,
    "minSide": 90,
    "maxSide": 215,
    "minColumnHits": 10,
}


def brightness(color: tuple[int, int, int]) -> float:
    return sum(color) / 3.0


def chroma(color: tuple[int, int, int]) -> int:
    return max(color) - min(color)


def slider_gray(color: tuple[int, int, int]) -> bool:
    mn = min(color)
    mx = max(color)
    return mn >= CFG["grayMin"] and mx <= CFG["grayMax"] and (mx - mn) <= CFG["grayChromaMax"]


def slider_track(color: tuple[int, int, int]) -> bool:
    mn = min(color)
    mx = max(color)
    return mn >= 205 and mx <= 235 and (mx - mn) <= 12


def slider_arrow(color: tuple[int, int, int]) -> bool:
    r, g, b = color
    return r <= 55 and g <= 55 and b <= 60


def region_from(profile: dict[str, Any], kind: str, name: str) -> dict[str, int]:
    return {k: int(round(profile[kind][name][k])) for k in ("x", "y", "w", "h")}


def pixel_ratio(img: Image.Image, region: dict[str, int], step: int, predicate: Callable[[tuple[int, int, int]], bool]) -> dict[str, Any]:
    hits = 0
    total = 0
    for y in range(0, region["h"], step):
        for x in range(0, region["w"], step):
            total += 1
            if predicate(img.getpixel((region["x"] + x, region["y"] + y))):
                hits += 1
    return {"ratio": hits / total if total else 0.0, "hits": hits, "total": total}


def column_runs(col_count: list[int], step: int, min_hits: int, quiet_limit: int, width: int) -> list[dict[str, int]]:
    runs: list[dict[str, int]] = []
    in_run = False
    start_slot = 0
    quiet_slots = 0
    for slot in range(0, len(col_count) + 1):
        active = slot < len(col_count) and col_count[slot] >= min_hits
        if active and not in_run:
            in_run = True
            start_slot = slot
            quiet_slots = 0
        elif not active and in_run:
            quiet_slots += 1
            if quiet_slots > quiet_limit or slot == len(col_count):
                runs.append({"x1": start_slot * step, "x2": min(width - 1, (slot - quiet_slots + 1) * step)})
                in_run = False
                quiet_slots = 0
        elif active:
            quiet_slots = 0
    return runs


def detect_slider_image_signal(img: Image.Image, region: dict[str, int]) -> dict[str, Any]:
    step = CFG["fastImageScanStep"]
    y_start = round(region["h"] * 0.34)
    y_end = round(region["h"] * 0.9)
    col_count = [0 for _ in range(0, region["w"] + 1, step)]
    gray_hits = 0
    total = 0
    for y in range(y_start, y_end, step):
        for x in range(0, region["w"], step):
            total += 1
            if slider_gray(img.getpixel((region["x"] + x, region["y"] + y))):
                gray_hits += 1
                col_count[x // step] += 1
    runs = column_runs(col_count, step, CFG["fastImageMinColumnHits"], 2, region["w"])
    min_side = round(CFG["minSide"] * 0.55)
    max_side = round(CFG["maxSide"] * 1.45)
    boxes = []
    for run in runs:
        run_w = run["x2"] - run["x1"] + 1
        if min_side <= run_w <= max_side:
            boxes.append({"x": region["x"] + run["x1"], "y": region["y"] + y_start, "w": run_w, "h": run_w})
    ratio = gray_hits / total if total else 0.0
    return {
        "ok": len(boxes) >= 1 and ratio >= CFG["imageProbeMinRatio"],
        "ratio": ratio,
        "hits": gray_hits,
        "total": total,
        "boxes": boxes,
        "runs": len(runs),
        "step": step,
    }


def detect_slider_type(img: Image.Image, profile: dict[str, Any]) -> dict[str, Any]:
    track_region = region_from(profile, "sliderProfile", "trackRegion")
    handle_region = region_from(profile, "sliderProfile", "handleRegion")
    image_region = region_from(profile, "sliderProfile", "imageSearchRegion")
    step = CFG["fastTypeProbeStep"]
    track = pixel_ratio(img, track_region, step, slider_track)
    arrow = pixel_ratio(img, handle_region, step, slider_arrow)
    image_probe = detect_slider_image_signal(img, image_region) if (track["hits"] or arrow["hits"]) else None
    track_ok = track["ratio"] >= CFG["trackMinRatio"]
    arrow_ok = arrow["ratio"] >= CFG["arrowMinRatio"]
    arrow_strong_ok = arrow["ratio"] >= CFG["arrowStrongMinRatio"]
    track_presence_ok = track["ratio"] >= CFG["trackPresenceMinRatio"] and track["hits"] >= CFG["trackPresenceMinHits"]
    handle_presence_ok = arrow["ratio"] >= CFG["handlePresenceMinRatio"] and arrow["hits"] >= CFG["handlePresenceMinHits"]
    image_ok = bool(image_probe and image_probe["ok"])
    paired_weak_ok = track_presence_ok and handle_presence_ok and arrow["ratio"] >= CFG["handleConfirmMinRatio"]
    ui_slider_ok = track_presence_ok and handle_presence_ok
    image_polluted = bool(image_probe and image_probe["ratio"] >= CFG["pollutedImageMinRatio"] and len(image_probe["boxes"]) < 2)
    type_ok = ui_slider_ok or arrow_strong_ok or (image_ok and (handle_presence_ok or track_presence_ok)) or paired_weak_ok
    return {
        "ok": type_ok,
        "typeOk": type_ok,
        "trackRatio": track["ratio"],
        "trackHits": track["hits"],
        "trackTotal": track["total"],
        "arrowRatio": arrow["ratio"],
        "arrowHits": arrow["hits"],
        "arrowTotal": arrow["total"],
        "trackOk": track_ok,
        "arrowOk": arrow_ok,
        "arrowStrongOk": arrow_strong_ok,
        "trackPresenceOk": track_presence_ok,
        "handlePresenceOk": handle_presence_ok,
        "uiSliderOk": ui_slider_ok,
        "imageOk": image_ok,
        "imagePolluted": image_polluted,
        "imageRatio": image_probe["ratio"] if image_probe else 0.0,
        "imageBoxes": len(image_probe["boxes"]) if image_probe else 0,
        "pairedWeakOk": paired_weak_ok,
    }


def result_from_boxes(region: dict[str, int], boxes: list[dict[str, float]], fallback: str) -> dict[str, Any]:
    if len(boxes) < 1:
        return {"ok": False, "reason": "slider_boxes_empty", "fallback": fallback}
    if len(boxes) == 1:
        target = boxes[0]
        return {"ok": True, "targetX": round(target["centerX"]), "targetY": round(target["centerY"]), "fallback": fallback, "boxes": boxes}
    boxes = sorted(boxes, key=lambda b: b["w"], reverse=True)[:2]
    pair = sorted(boxes, key=lambda b: (b["w"], b["centerX"]))
    target = pair[0]
    return {"ok": True, "targetX": round(target["centerX"]), "targetY": round(target["centerY"]), "fallback": fallback, "boxes": pair}


def recognize_slider_fast(img: Image.Image, profile: dict[str, Any]) -> dict[str, Any]:
    region = region_from(profile, "sliderProfile", "imageSearchRegion")
    step = CFG["scanStep"]
    y_start = round(region["h"] * 0.34)
    y_end = round(region["h"] * 0.9)
    col_count = [0 for _ in range(0, region["w"] + 1, step)]
    for y in range(y_start, y_end, step):
        for x in range(0, region["w"], step):
            if slider_gray(img.getpixel((region["x"] + x, region["y"] + y))):
                col_count[x // step] += 1
    runs = column_runs(col_count, step, CFG["minColumnHits"], 3, region["w"])
    boxes: list[dict[str, float]] = []
    for run in runs:
        run_w = run["x2"] - run["x1"] + 1
        if CFG["minSide"] <= run_w <= CFG["maxSide"]:
            boxes.append({
                "x": region["x"] + run["x1"],
                "y": region["y"] + y_start,
                "w": run_w,
                "h": run_w,
                "centerX": region["x"] + run["x1"] + run_w / 2,
                "centerY": region["y"] + y_start + run_w / 2,
            })
    if len(boxes) < 2:
        return {"ok": False, "reason": f"slider_gray_boxes={len(boxes)} runs={len(runs)}", "boxes": boxes, "runs": len(runs)}
    out = result_from_boxes(region, boxes, "")
    out["runs"] = len(runs)
    return out


def polluted_bright_columns(img: Image.Image, profile: dict[str, Any]) -> dict[str, Any]:
    region = region_from(profile, "sliderProfile", "imageSearchRegion")
    step = CFG["pollutedFallbackStep"]
    y_start = round(region["h"] * 0.34)
    y_end = round(region["h"] * 0.9)
    column_samples = max(1, (y_end - y_start) // step)
    col_count = [0 for _ in range(0, region["w"] + 1, step)]
    for y in range(y_start, y_end, step):
        for x in range(0, region["w"], step):
            color = img.getpixel((region["x"] + x, region["y"] + y))
            br = brightness(color)
            if 205 <= br <= 245 and chroma(color) <= 16:
                col_count[x // step] += 1
    min_center = region["x"] + region["w"] * CFG["pollutedFallbackMinCenterRatio"]
    preferred_max_center = region["x"] + region["w"] * CFG["pollutedBrightMaxCenterRatio"]
    boxes = []
    run_details = []

    def append_boxes_for_ratio(ratio: float) -> None:
        min_hits = max(8, round(column_samples * ratio))
        runs = column_runs(col_count, step, min_hits, 2, region["w"])
        run_details.append(f"{ratio}:{len(runs)}/{min_hits}")
        for run in runs:
            run_w = run["x2"] - run["x1"] + 1
            cx = region["x"] + run["x1"] + run_w / 2
            if round(CFG["minSide"] * 0.85) <= run_w <= round(CFG["maxSide"] * 1.10) and cx >= min_center:
                boxes.append({
                    "x": region["x"] + run["x1"],
                    "y": region["y"] + y_start,
                    "w": run_w,
                    "h": run_w,
                    "centerX": cx,
                    "centerY": region["y"] + y_start + run_w / 2,
                    "columnRatio": ratio,
                    "minColumnHits": min_hits,
                })

    append_boxes_for_ratio(CFG["pollutedBrightColumnStrongRatio"])
    if CFG["pollutedBrightColumnMinRatio"] != CFG["pollutedBrightColumnStrongRatio"]:
        append_boxes_for_ratio(CFG["pollutedBrightColumnMinRatio"])
    if not boxes:
        return {"ok": False, "reason": f"bright_columns_boxes=0 runs={','.join(run_details)}"}
    preferred = [b for b in boxes if b["centerX"] <= preferred_max_center]
    pool = preferred or boxes
    pool = sorted(pool, key=lambda b: (-b["columnRatio"], b["centerX"]))
    return result_from_boxes(region, [pool[0]], "polluted_bright_columns")


def polluted_edge_score(img: Image.Image, region: dict[str, int], rel_x: int, y_start: int, y_end: int, step: int) -> float:
    rel_x = max(step * 2, min(region["w"] - step * 2, int(round(rel_x))))
    vals = []
    for y in range(y_start, y_end, step):
        left = brightness(img.getpixel((region["x"] + rel_x - step, region["y"] + y)))
        right = brightness(img.getpixel((region["x"] + rel_x + step, region["y"] + y)))
        vals.append(abs(right - left))
    return sum(vals) / len(vals) if vals else 0.0


def polluted_edges(img: Image.Image, profile: dict[str, Any]) -> dict[str, Any]:
    region = region_from(profile, "sliderProfile", "imageSearchRegion")
    step = CFG.get("pollutedEdgeStep") or max(12, CFG["pollutedFallbackStep"])
    y_start = round(region["h"] * 0.34)
    y_end = round(region["h"] * 0.9)
    min_center = region["x"] + region["w"] * CFG["pollutedFallbackMinCenterRatio"]
    candidates = []
    edge_cache: dict[int, float] = {}

    def edge_at(rel_x: int) -> float:
        key = round(rel_x / step) * step
        key = max(step * 2, min(region["w"] - step * 2, key))
        if key not in edge_cache:
            edge_cache[key] = polluted_edge_score(img, region, key, y_start, y_end, step)
        return edge_cache[key]

    for x1 in range(0, region["w"] - round(CFG["minSide"] * 0.85), step):
        for side in range(round(CFG["minSide"] * 0.85), round(CFG["maxSide"] * 0.90) + 1, step):
            x2 = x1 + side
            if x2 >= region["w"]:
                continue
            cx = region["x"] + x1 + side / 2
            if cx < min_center:
                continue
            left_edge = edge_at(x1)
            right_edge = edge_at(x2)
            if left_edge <= 15 or right_edge <= 15:
                continue
            neutral = 0
            dark = 0
            total = 0
            sample_bottom = min(y_start + side, y_end)
            for xx in range(x1 + step, x2 - step, step * 2):
                for yy in range(y_start + step, sample_bottom - step, step * 2):
                    color = img.getpixel((region["x"] + xx, region["y"] + yy))
                    br = brightness(color)
                    total += 1
                    if 150 <= br <= 252 and chroma(color) <= 65:
                        neutral += 1
                    if br < 70:
                        dark += 1
            neutral_ratio = neutral / total if total else 0.0
            dark_ratio = dark / total if total else 1.0
            score = left_edge + right_edge + neutral_ratio * 20 - dark_ratio * 25
            if score < CFG["pollutedFallbackMinScore"]:
                continue
            candidates.append({
                "x": region["x"] + x1,
                "y": region["y"] + y_start,
                "w": side,
                "h": side,
                "centerX": cx,
                "centerY": region["y"] + y_start + side / 2,
                "score": score,
                "neutralRatio": neutral_ratio,
                "darkRatio": dark_ratio,
            })
    if not candidates:
        return {"ok": False, "reason": "polluted_edge_candidates=0"}
    preferred_max_center = region["x"] + region["w"] * 0.70
    preferred = [c for c in candidates if c["centerX"] <= preferred_max_center]
    pool = preferred or candidates
    pool = sorted(pool, key=lambda b: (-b["score"], b["centerX"]))
    return result_from_boxes(region, [pool[0]], "polluted_edge")


def analyze_image(path: Path, expected: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    img = Image.open(path).convert("RGB")
    width, height = img.size
    row: dict[str, Any] = {
        "file": str(path),
        "width": width,
        "height": height,
        "expectedType": expected.get("type", ""),
        "case": expected.get("case", ""),
    }
    if width < 1000 or height < 2000:
        row.update({"actualType": "skipped", "reason": "not_fullscreen_image", "elapsedMs": round((time.perf_counter() - start) * 1000, 2)})
        return row
    type_probe = detect_slider_type(img, profile)
    actual_type = "slider" if type_probe["ok"] else "math"
    row.update(type_probe)
    row["actualType"] = actual_type
    row["enteredPollutedFallback"] = False
    row["targetX"] = ""
    row["targetError"] = ""
    if actual_type == "slider":
        fast = recognize_slider_fast(img, profile)
        loc = fast
        if not fast["ok"] and type_probe["uiSliderOk"] and type_probe["imagePolluted"]:
            row["enteredPollutedFallback"] = True
            loc = polluted_bright_columns(img, profile)
            search_region = region_from(profile, "sliderProfile", "imageSearchRegion")
            bright_too_far_right = bool(loc.get("ok") and loc.get("targetX") != "" and int(loc["targetX"]) > search_region["x"] + search_region["w"] * CFG["pollutedBrightMaxCenterRatio"])
            if not loc["ok"] or bright_too_far_right:
                edge_loc = polluted_edges(img, profile)
                if edge_loc["ok"]:
                    loc = edge_loc
        row["targetX"] = loc.get("targetX", "")
        row["targetFallback"] = loc.get("fallback", "")
        row["targetReason"] = loc.get("reason", "")
        if expected.get("targetX") is not None and row["targetX"] != "":
            row["targetError"] = abs(int(row["targetX"]) - int(expected["targetX"]))
    expected_type = row["expectedType"]
    passed: bool | str = ""
    if expected_type == "slider":
        passed = actual_type == "slider"
        if passed and expected.get("targetX") is not None:
            tolerance = int(expected.get("targetTolerance", 45))
            passed = row["targetX"] != "" and abs(int(row["targetX"]) - int(expected["targetX"])) <= tolerance
    elif expected_type == "math":
        passed = actual_type == "math"
    row["pass"] = passed
    row["elapsedMs"] = round((time.perf_counter() - start) * 1000, 2)
    return row


def infer_expected(path: Path) -> dict[str, Any]:
    text = (path.name + " " + " ".join(part for part in path.parts)).lower()
    if "滑块" in text or "slider" in text:
        return {"file": str(path), "type": "slider"}
    if "数学" in text or "math" in text:
        return {"file": str(path), "type": "math"}
    return {"file": str(path), "type": ""}


def load_manifest(path: Path) -> tuple[Path, list[dict[str, Any]], dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return path.parent, data, DEFAULT_PROFILE
    cases = data.get("cases", [])
    profile = data.get("profile") or DEFAULT_PROFILE
    base_dir = Path(data.get("baseDir", path.parent))
    if not base_dir.is_absolute():
        base_dir = path.parent / base_dir
    return base_dir, cases, profile


def discover(root: Path) -> list[dict[str, Any]]:
    cases = []
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            name = path.name.lower()
            if "expr" in name or "preprocessed" in name:
                continue
            cases.append(infer_expected(path))
    return cases


def write_outputs(rows: list[dict[str, Any]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    csv_path = output.with_suffix(".csv")
    fieldnames = [
        "file", "case", "expectedType", "actualType", "pass",
        "trackRatio", "arrowRatio", "imageRatio", "imageBoxes",
        "uiSliderOk", "imagePolluted", "enteredPollutedFallback",
        "targetX", "targetFallback", "targetError", "targetReason", "elapsedMs",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="resource/log", help="Directory to auto-discover screenshots from.")
    parser.add_argument("--manifest", help="Manifest JSON with explicit cases.")
    parser.add_argument("--output", default="resource/log/captcha_batch_summary.json", help="Summary JSON output path.")
    args = parser.parse_args()

    if args.manifest:
        base_dir, cases, profile = load_manifest(Path(args.manifest))
    else:
        base_dir = Path(".")
        cases = discover(Path(args.root))
        profile = DEFAULT_PROFILE

    rows = []
    for case in cases:
        file_path = Path(case["file"])
        if not file_path.is_absolute():
            file_path = base_dir / file_path
        rows.append(analyze_image(file_path, case, profile))
    write_outputs(rows, Path(args.output))

    checked = [r for r in rows if r.get("pass") != ""]
    passed = [r for r in checked if r.get("pass") is True]
    sliders = [r for r in rows if r.get("actualType") == "slider"]
    fallback = [r for r in rows if r.get("enteredPollutedFallback") is True]
    print(f"analyzed={len(rows)} checked={len(checked)} passed={len(passed)} sliders={len(sliders)} pollutedFallback={len(fallback)}")
    print(f"summary={Path(args.output)} csv={Path(args.output).with_suffix('.csv')}")
    for row in rows:
        print(
            f"{row.get('pass','')} expected={row.get('expectedType','')} actual={row.get('actualType','')} "
            f"track={float(row.get('trackRatio') or 0):.3f} arrow={float(row.get('arrowRatio') or 0):.3f} "
            f"image={float(row.get('imageRatio') or 0):.3f} boxes={row.get('imageBoxes','')} "
            f"fallback={row.get('enteredPollutedFallback','')} targetX={row.get('targetX','')} "
            f"ms={row.get('elapsedMs','')} file={Path(row.get('file','')).name}"
        )


if __name__ == "__main__":
    main()
