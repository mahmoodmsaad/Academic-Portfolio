from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from direct_interface_workflow import run_direct_interface_workflow


def cors_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps(payload),
    }


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {})

    try:
        raw_body = event.get("body", event)
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        payload = run_direct_interface_workflow(body)
        return response(200, payload)
    except ValueError as exc:
        return response(400, {"success": False, "error": str(exc)})
    except Exception as exc:
        return response(500, {"success": False, "error": str(exc)})


if __name__ == "__main__":
    demo = {
        "element": "Pt",
        "h": 8,
        "k": 8,
        "l": 1,
        "backend": "ase",
        "substrate": {
            "layers": 16,
            "vacuum": 15,
            "repeat_max": 3,
            "lattice_a": 3.923,
        },
        "film": {
            "name": "hBN",
            "a": 2.5,
            "b": 2.5,
            "gamma": 120.0,
            "atoms_per_cell": 2,
            "base_atoms": [
                {"symbol": "B", "x": 0.0, "y": 0.0, "z": 0.5},
                {"symbol": "N", "x": 1.0 / 3.0, "y": 2.0 / 3.0, "z": 0.5},
            ],
            "vacuum": 15,
        },
        "matching": {
            "max_mismatch": 0.05,
            "max_area": 400,
            "top_k": 3,
            "min_inplane_angle": 45,
            "max_aspect_ratio": 8,
            "gap": 3.2,
        },
    }
    print(json.dumps(run_direct_interface_workflow(demo), indent=2))
