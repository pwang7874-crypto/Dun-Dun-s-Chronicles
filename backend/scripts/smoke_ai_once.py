"""One authorized paid model call through an isolated local API. No production user writes.

The persistent exclusive marker prevents accidental reruns, even after timeout.
Never remove the marker without a new user authorization.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import secrets
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app.core.config as config
from app.services.ai_provider import ArkSeedreamProvider


def main():
    production = config.Settings(_env_file=".env.production")
    source = Path("../mobile/src/assets/ai-styles/polaroid-note.jpg")
    image = source.read_bytes()
    assert production.ark_ready and len(image) < 10 * 1024 * 1024
    artifacts = Path("data/ai-repair-20260906")
    artifacts.mkdir(parents=True, exist_ok=True)
    marker = artifacts / "paid-call-started.txt"
    # x is exclusive: another invocation cannot consume a second paid call.
    with marker.open("x") as log:
        log.write("User authorized at most one model generation; no automatic retry.\n")
    calls = 0
    provider = ArkSeedreamProvider(production)

    class OneCallProvider:
        def generate(self, data, mime, prompt):
            nonlocal calls
            assert calls == 0, "Second paid generation forbidden"
            calls += 1
            return provider.generate(data, mime, prompt)

    start = time.monotonic()
    try:
        with TemporaryDirectory(prefix="dundun-ai-smoke-") as directory:
            settings = config.Settings(_env_file=None, DUNDUNJI_ENV="test",
                database_url=f"sqlite:///{directory}/smoke.sqlite3", storage_backend="local",
                local_storage_dir=Path(directory) / "storage", allow_dev_auth=True,
                session_signing_secret=secrets.token_hex(32), phone_hash_secret=secrets.token_hex(32),
                invite_code_secret=secrets.token_hex(32))
            # app.main constructs a default application on import: isolate that one too.
            config.get_settings = lambda: settings
            from app.main import create_app
            from app.models import User
            from fastapi.testclient import TestClient
            from sqlalchemy import select
            app = create_app(settings, ai_provider=OneCallProvider())
            with TestClient(app) as client:
                login = client.post("/api/v1/dev/session", json={"phone": "13800000000"})
                assert login.status_code == 200
                headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
                with app.state.session_factory() as db:
                    user = db.scalar(select(User))
                    user.invite_credits_remaining = 1
                    db.commit()
                request = dict(headers=headers,
                    data={"idempotency_key": "authorized-smoke-once-20260906", "record_id": "sample-cup", "style_id": "cream-poster"},
                    files={"image": ("sample.jpg", image, "image/jpeg")})
                response = client.post("/api/v1/ai/generations", **request)
                if response.status_code != 201:
                    error = response.json().get("error", {}).get("code", "UNKNOWN")
                    raise RuntimeError(f"HTTP {response.status_code}, code={error}")
                job = response.json()
                assert job["status"] == "completed"
                assert client.get(f"/api/v1/ai/generations/{job['jobId']}", headers=headers).json()["status"] == "completed"
                result = client.get(job["outputUrl"], headers=headers)
                assert result.status_code == 200 and len(result.content) > 1000
                assert client.get(job["outputUrl"]).status_code == 401
                # This second HTTP request MUST reuse the already completed job, not the provider.
                duplicate = client.post("/api/v1/ai/generations", **request)
                assert duplicate.status_code == 201 and duplicate.json()["jobId"] == job["jobId"]
                assert calls == 1
                remaining = client.get("/api/v1/me/entitlements", headers=headers).json()["inviteCreditsRemaining"]
                assert remaining == 0
                extension = "png" if result.content.startswith(b"\x89PNG") else "jpg"
                output = artifacts / f"real-ark-result.{extension}"
                output.write_bytes(result.content)
                report = {"status": "passed", "paid_model_calls": calls, "elapsed_seconds": round(time.monotonic() - start, 2),
                    "output_bytes": len(result.content), "output_sha256": hashlib.sha256(result.content).hexdigest(),
                    "checks": ["authenticated create", "completed status", "authenticated image download", "unauthenticated denied", "idempotency no second generation", "one credit only"],
                    "scope": "Production Ark configuration; isolated local API/SQLite/storage, not a live phone or production gateway test", "output": str(output)}
    except Exception as error:
        report = {"status": "failed", "paid_model_calls": calls, "elapsed_seconds": round(time.monotonic() - start, 2), "error_type": type(error).__name__, "retry": "forbidden without new user approval"}
    (artifacts / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
