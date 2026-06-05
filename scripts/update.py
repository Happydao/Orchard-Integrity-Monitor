#!/usr/bin/env python3
"""Build the static dataset used by Orchard Integrity Monitor."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = "https://api.zcashinfo.com/api/v1"
BLOCKCHAIR_BASE_URL = "https://api.blockchair.com/zcash"
NU5_BLOCK = 1_687_104
PATCH_BLOCK = 3_363_426
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTFILE = DATA_DIR / "data.json"

POOL_KEYS = (
    "transparent_zatoshis",
    "sapling_zatoshis",
    "orchard_zatoshis",
    "sprout_zatoshis",
    "lockbox_zatoshis",
)


def fetch_json(path: str):
    request = Request(
        f"{BASE_URL}{path}",
        headers={
            "Accept": "application/json",
            "User-Agent": "orchard-monitor/1.0",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} while fetching {path}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error while fetching {path}: {exc.reason}") from exc


def fetch_url_json(url: str):
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "orchard-monitor/1.0",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} while fetching {url}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error while fetching {url}: {exc.reason}") from exc


def as_int(value) -> int:
    if value is None:
        return 0
    return int(value)


def build_integrity(pools: dict) -> dict:
    supply = as_int(pools.get("total_supply_zatoshis"))
    pool_sum = sum(as_int(pools.get(key)) for key in POOL_KEYS)
    diff = supply - pool_sum
    abs_diff = abs(diff)

    if abs_diff == 0:
        status = "OK"
    elif abs_diff <= 10:
        status = "WARNING"
    else:
        status = "ALERT"

    return {
        "supply_emitted_zatoshis": supply,
        "sum_of_pools_zatoshis": pool_sum,
        "difference_zatoshis": diff,
        "status": status,
    }


def normalize_history(history: list[dict]) -> list[dict]:
    normalized = []
    for point in history:
        normalized.append(
            {
                "height": as_int(point.get("height")),
                "timestamp": as_int(point.get("timestamp")),
                "transparent_zatoshis": as_int(point.get("transparent_zatoshis")),
                "sapling_zatoshis": as_int(point.get("sapling_zatoshis")),
                "orchard_zatoshis": as_int(point.get("orchard_zatoshis")),
                "sprout_zatoshis": as_int(point.get("sprout_zatoshis")),
                "lockbox_zatoshis": as_int(point.get("lockbox_zatoshis")),
            }
        )
    return sorted(normalized, key=lambda item: item["height"])


def percent(part: int, total: int) -> float:
    return (part / total * 100) if total else 0


def build_adoption_metrics(pools: dict) -> dict:
    supply = as_int(pools.get("total_supply_zatoshis"))
    orchard = as_int(pools.get("orchard_zatoshis"))
    sapling = as_int(pools.get("sapling_zatoshis"))
    sprout = as_int(pools.get("sprout_zatoshis"))
    transparent = as_int(pools.get("transparent_zatoshis"))
    shielded = orchard + sapling + sprout

    return {
        "orchard_share_of_supply_pct": percent(orchard, supply),
        "total_shielded_share_pct": percent(shielded, supply),
        "transparent_share_pct": percent(transparent, supply),
        "orchard_dominance_pct": percent(orchard, shielded),
    }


def build_share_history(history: list[dict]) -> list[dict]:
    share_history = []
    for point in history:
        total = sum(as_int(point.get(key)) for key in POOL_KEYS)
        if total <= 0:
            continue
        share_history.append(
            {
                "height": as_int(point.get("height")),
                "timestamp": as_int(point.get("timestamp")),
                "orchard_pct": percent(as_int(point.get("orchard_zatoshis")), total),
                "sapling_pct": percent(as_int(point.get("sapling_zatoshis")), total),
                "transparent_pct": percent(as_int(point.get("transparent_zatoshis")), total),
            }
        )
    return share_history


def closest_or_before(history: list[dict], timestamp: int) -> dict | None:
    candidates = [point for point in history if as_int(point.get("timestamp")) <= timestamp]
    if not candidates:
        return None
    return max(candidates, key=lambda point: as_int(point.get("timestamp")))


def pool_by_id(value_pools: list[dict], pool_id: str) -> dict:
    for pool in value_pools:
        if pool.get("id") == pool_id:
            return pool
    raise RuntimeError(f"Pool {pool_id!r} not found in patch block")


def fetch_block_snapshot(height: int) -> dict:
    raw = fetch_url_json(f"{BLOCKCHAIR_BASE_URL}/raw/block/{height}")
    block = raw["data"][str(height)]["decoded_raw_block"]
    orchard = pool_by_id(block["valuePools"], "orchard")

    return {
        "block": height,
        "timestamp": as_int(block.get("time")),
        "hash": block.get("hash"),
        "source": "Blockchair raw block",
        "source_url": f"{BLOCKCHAIR_BASE_URL}/raw/block/{height}",
        "orchard_balance_zatoshis": as_int(orchard.get("chainValueZat")),
        "orchard_value_delta_zatoshis": as_int(orchard.get("valueDeltaZat")),
        "value_delta_available": "valueDeltaZat" in orchard,
    }


def build_patch_metrics(patch: dict, pools: dict, history: list[dict]) -> dict:
    patch_balance = as_int(patch["orchard_balance_zatoshis"])
    current_balance = as_int(pools.get("orchard_zatoshis"))
    net_change = current_balance - patch_balance
    net_change_pct = percent(net_change, patch_balance)
    current_ts = as_int(history[-1]["timestamp"]) if history else as_int(patch["timestamp"])
    daily_point = closest_or_before(history, current_ts - 86_400)
    weekly_point = closest_or_before(history, current_ts - 7 * 86_400)
    daily_change = current_balance - as_int(daily_point.get("orchard_zatoshis")) if daily_point else 0
    weekly_change = current_balance - as_int(weekly_point.get("orchard_zatoshis")) if weekly_point else 0

    return {
        **patch,
        "current_orchard_balance_zatoshis": current_balance,
        "moved_since_patch_zatoshis": -net_change,
        "percent_moved_since_patch": percent(-net_change, patch_balance),
        "net_change_zatoshis": net_change,
        "net_change_pct": net_change_pct,
        "daily_change_zatoshis": daily_change,
        "weekly_change_zatoshis": weekly_change,
        "daily_change_reference_height": as_int(daily_point.get("height")) if daily_point else None,
        "weekly_change_reference_height": as_int(weekly_point.get("height")) if weekly_point else None,
    }


def build_historical_snapshots(nu5: dict, patch: dict, pools: dict, info: dict) -> dict:
    current = as_int(pools.get("orchard_zatoshis"))
    nu5_balance = as_int(nu5.get("orchard_balance_zatoshis"))
    patch_balance = as_int(patch.get("orchard_balance_zatoshis"))

    return {
        "nu5": nu5,
        "patch": patch,
        "current": {
            "block": as_int(info.get("chain_tip") or info.get("best_block")),
            "timestamp": None,
            "orchard_balance_zatoshis": current,
            "source": "ZcashInfo current pools",
            "source_url": f"{BASE_URL}/coin-pools",
        },
        "growth_since_nu5_zatoshis": current - nu5_balance,
        "change_since_patch_zatoshis": current - patch_balance,
    }


def comparable_dataset(dataset: dict) -> dict:
    return {key: value for key, value in dataset.items() if key != "generated_at"}


def main() -> int:
    pools = fetch_json("/coin-pools")
    dashboard = fetch_json("/dashboard")
    history = normalize_history(fetch_json("/coin-pools/history?range=all"))
    recent_history = normalize_history(fetch_json("/coin-pools/history?range=1m"))
    nu5 = fetch_block_snapshot(NU5_BLOCK)
    patch = fetch_block_snapshot(PATCH_BLOCK)
    info = dashboard.get("info", {})

    dataset = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "ZcashInfo API",
            "docs": "https://api.zcashinfo.com/docs",
            "base_url": BASE_URL,
        },
        "current": {
            "info": info,
            "pools": {key: as_int(value) for key, value in pools.items()},
        },
        "integrity": build_integrity(pools),
        "adoption": build_adoption_metrics(pools),
        "patch": build_patch_metrics(patch, pools, recent_history or history),
        "historical_snapshots": build_historical_snapshots(nu5, patch, pools, info),
        "audit_notes": {
            "full_2022_audit_implemented": False,
            "block_value_delta_available": True,
            "block_value_delta_source": "Blockchair raw block decoded_raw_block.valuePools[].valueDeltaZat",
            "zcashinfo_block_verbose_value_delta_available": False,
            "estimated_block_requests_from_nu5_to_patch": PATCH_BLOCK - 1_687_104 + 1,
        },
        "share_history": build_share_history(history),
        "history": history,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if OUTFILE.exists():
        existing = json.loads(OUTFILE.read_text(encoding="utf-8"))
        if comparable_dataset(existing) == comparable_dataset(dataset):
            print(f"No data changes for {OUTFILE.relative_to(ROOT)}")
            print(f"Integrity: {dataset['integrity']['status']}")
            print(f"History points: {len(dataset['history'])}")
            return 0

    OUTFILE.write_text(json.dumps(dataset, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUTFILE.relative_to(ROOT)}")
    print(f"Integrity: {dataset['integrity']['status']}")
    print(f"History points: {len(dataset['history'])}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"update failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
