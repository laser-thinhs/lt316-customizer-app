from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _layout() -> dict:
    return {
        "id": "default",
        "name": "default",
        "blocks": [
            {"id": "text-1", "type": "text", "props": {"text": "Hello", "align": "left"}},
        ],
    }


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_valid_proposal() -> None:
    response = client.post("/v1/layout/propose", json={"layout": _layout(), "instruction": "change text"})
    assert response.status_code == 200
    body = response.json()
    assert body["next_layout"]["blocks"][0]["props"]["text"] == "Updated by Studio AI"


def test_invalid_block_type_rejected() -> None:
    bad = _layout()
    bad["blocks"][0]["type"] = "bad"
    response = client.post("/v1/layout/propose", json={"layout": bad, "instruction": "change text"})
    assert response.status_code == 422


def test_payload_too_large_rejected() -> None:
    huge = "x" * 70000
    response = client.post("/v1/layout/propose", content=huge.encode("utf-8"), headers={"content-type": "application/json"})
    assert response.status_code == 413


def test_patch_does_not_modify_id_type() -> None:
    response = client.post("/v1/layout/propose", json={"layout": _layout(), "instruction": "add 3d model and move block"})
    assert response.status_code == 200
    body = response.json()
    original = _layout()["blocks"][0]
    updated = body["next_layout"]["blocks"][1]
    assert original["id"] == updated["id"]
    assert original["type"] == updated["type"]


def test_code_propose_returns_patch_payload() -> None:
    response = client.post(
        "/v1/code/propose",
        json={
            "instruction": "Add a note in studio docs",
            "target": "src/studio",
            "repo_context": {"tree_hint": ["src/studio"]},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "proposal_id" in body
    assert "patch" in body
    assert body["patch"].startswith("diff --git ")
