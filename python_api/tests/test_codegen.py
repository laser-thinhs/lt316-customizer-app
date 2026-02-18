from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_propose_returns_patch_string():
    response = client.post(
        "/v1/code/propose",
        json={"instruction": "Create a new block called Cylinder3DBlock and register it in the block registry"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["patch"], str)
    assert "diff --git" in payload["patch"]


def test_fallback_patch_stays_in_allowlisted_paths():
    response = client.post(
        "/v1/code/propose",
        json={"instruction": "new block named ExampleBlock"},
    )
    payload = response.json()
    patch = payload["patch"]
    files = [line.split(" ")[3][2:] for line in patch.splitlines() if line.startswith("diff --git")]
    assert files
    assert all(path.startswith("src/studio/") for path in files)
