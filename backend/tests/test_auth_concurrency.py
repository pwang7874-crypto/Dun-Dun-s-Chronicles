from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AuthenticationError
from app.core.security import hash_phone, hash_sms_code
from app.models import SmsChallenge, User, new_id
from app.services.auth import AuthService
from tests.conftest import FakeSmsProvider


CODE = "123456"
PHONE = "13800000077"


def add_challenge(app, *, attempts=0, expires_at=None):
    now = datetime.now(timezone.utc)
    challenge_id = new_id()
    secret = app.state.settings.phone_hash_secret
    with app.state.session_factory() as db:
        db.add(
            SmsChallenge(
                id=challenge_id,
                phone_hash=hash_phone(PHONE, secret),
                phone_last4=PHONE[-4:],
                code_hash=hash_sms_code(challenge_id, CODE, secret),
                attempts=attempts,
                expires_at=expires_at or now + timedelta(minutes=5),
            )
        )
        db.commit()
    return challenge_id


def concurrent_verifications(app, requests):
    barrier = Barrier(len(requests))

    class ConcurrentSession(Session):
        def get(self, entity, ident, **kwargs):
            value = super().get(entity, ident, **kwargs)
            if entity is SmsChallenge and not self.info.get("challenge_read"):
                self.info["challenge_read"] = True
                barrier.wait(timeout=15)
            return value

    service = AuthService(
        sessionmaker(bind=app.state.engine, class_=ConcurrentSession, expire_on_commit=False),
        FakeSmsProvider(),
        app.state.tokens,
        app.state.settings.phone_hash_secret,
        app.state.settings.invite_code_secret,
    )

    def verify(request):
        try:
            user, token = service.verify_code(*request)
            assert app.state.tokens.verify(token).user_id == user.id
            return "success", user.id
        except AuthenticationError as exc:
            return "error", exc.code

    with ThreadPoolExecutor(max_workers=len(requests)) as executor:
        return list(executor.map(verify, requests))


def test_same_challenge_is_consumed_only_once_under_concurrent_correct_codes(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app)
    results = concurrent_verifications(app, [(challenge_id, CODE)] * 8)

    assert sum(result[0] == "success" for result in results) == 1
    assert sum(result == ("error", "SMS_CHALLENGE_INVALID") for result in results) == 7
    with app.state.session_factory() as db:
        challenge = db.get(SmsChallenge, challenge_id)
        assert challenge.consumed_at is not None
        assert challenge.attempts == 0
        assert db.scalar(select(func.count()).select_from(User)) == 1


def test_concurrent_wrong_codes_increment_atomically_and_stop_at_five(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app)
    results = concurrent_verifications(app, [(challenge_id, "000000")] * 8)

    assert sum(result == ("error", "SMS_CODE_INCORRECT") for result in results) == 5
    assert sum(result == ("error", "SMS_CHALLENGE_EXPIRED") for result in results) == 3
    with app.state.session_factory() as db:
        challenge = db.get(SmsChallenge, challenge_id)
        assert challenge.attempts == 5
        assert challenge.consumed_at is None
        assert db.scalar(select(func.count()).select_from(User)) == 0
    with pytest.raises(AuthenticationError) as error:
        app.state.auth_service.verify_code(challenge_id, CODE)
    assert error.value.code == "SMS_CHALLENGE_EXPIRED"


def test_mixed_concurrent_codes_cannot_reconsume_or_lose_attempt_updates(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app)
    requests = [(challenge_id, CODE)] * 4 + [(challenge_id, "000000")] * 4
    results = concurrent_verifications(app, requests)

    assert sum(result[0] == "success" for result in results) == 1
    wrong_count = sum(result == ("error", "SMS_CODE_INCORRECT") for result in results)
    with app.state.session_factory() as db:
        challenge = db.get(SmsChallenge, challenge_id)
        assert challenge.consumed_at is not None
        assert challenge.attempts == wrong_count
        assert 0 <= challenge.attempts <= 4


def test_last_attempt_race_has_one_atomic_winner(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app, attempts=4)
    results = concurrent_verifications(app, [(challenge_id, CODE), (challenge_id, "000000")])

    success_count = sum(result[0] == "success" for result in results)
    wrong_count = sum(result == ("error", "SMS_CODE_INCORRECT") for result in results)
    assert success_count + wrong_count == 1
    with app.state.session_factory() as db:
        challenge = db.get(SmsChallenge, challenge_id)
        assert challenge.attempts == 4 + wrong_count
        assert (challenge.consumed_at is not None) == (success_count == 1)


def test_multiple_challenges_for_one_phone_create_only_one_user(app_factory):
    app = app_factory()
    challenge_ids = [add_challenge(app) for _ in range(8)]
    results = concurrent_verifications(app, [(challenge_id, CODE) for challenge_id in challenge_ids])

    assert all(result[0] == "success" for result in results)
    assert len({result[1] for result in results}) == 1
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1
        assert all(db.get(SmsChallenge, challenge_id).consumed_at for challenge_id in challenge_ids)


def test_user_unique_conflict_recovers_without_rolling_back_consumption(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app)
    secret = app.state.settings.phone_hash_secret
    with app.state.session_factory() as db:
        existing = User(phone_hash=hash_phone(PHONE, secret), phone_last4=PHONE[-4:])
        db.add(existing)
        db.commit()
        existing_id = existing.id

    class StaleUserLookupSession(Session):
        def scalar(self, statement, *args, **kwargs):
            entities = [column.get("entity") for column in statement.column_descriptions]
            if User in entities and not self.info.get("user_lookup"):
                self.info["user_lookup"] = True
                return None
            return super().scalar(statement, *args, **kwargs)

    service = AuthService(
        sessionmaker(bind=app.state.engine, class_=StaleUserLookupSession, expire_on_commit=False),
        FakeSmsProvider(),
        app.state.tokens,
        secret,
        app.state.settings.invite_code_secret,
    )
    user, token = service.verify_code(challenge_id, CODE)

    assert user.id == existing_id
    assert app.state.tokens.verify(token).user_id == existing_id
    with app.state.session_factory() as db:
        assert db.get(SmsChallenge, challenge_id).consumed_at is not None
        assert db.scalar(select(func.count()).select_from(User)) == 1


def test_expired_challenge_is_never_consumed(app_factory):
    app = app_factory()
    challenge_id = add_challenge(app, expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))

    with pytest.raises(AuthenticationError) as error:
        app.state.auth_service.verify_code(challenge_id, CODE)
    assert error.value.code == "SMS_CHALLENGE_EXPIRED"
    with app.state.session_factory() as db:
        assert db.get(SmsChallenge, challenge_id).consumed_at is None
        assert db.scalar(select(func.count()).select_from(User)) == 0
