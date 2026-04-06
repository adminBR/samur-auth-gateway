from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import APIException, AuthenticationFailed

from utils import database
from users.tasy_auth import normalize_tasy_username

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def normalize_access_lifetime(value) -> int | str:
    raw_value = settings.AUTH_ACCESS_TOKEN_DEFAULT_DAYS if value in (None, "") else value

    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        if not normalized:
            normalized = str(settings.AUTH_ACCESS_TOKEN_DEFAULT_DAYS).strip().lower()

        if normalized == "inf":
            return "inf"

        if normalized.isdigit():
            raw_value = int(normalized)
        else:
            raise ValueError("Access token expiration must be a positive integer or 'inf'.")

    if isinstance(raw_value, int):
        if raw_value < 1:
            raise ValueError("Access token expiration must be greater than zero.")
        return raw_value

    raise ValueError("Access token expiration must be a positive integer or 'inf'.")


def serialize_access_lifetime(value) -> str:
    normalized = normalize_access_lifetime(value)
    return "inf" if normalized == "inf" else str(normalized)


def normalize_refresh_lifetime_days(value=None) -> int:
    raw_value = settings.AUTH_REFRESH_TOKEN_DAYS if value in (None, "") else value

    if isinstance(raw_value, str):
        raw_value = raw_value.strip()
        if not raw_value.isdigit():
            raise ValueError("Refresh token expiration must be a positive integer.")
        raw_value = int(raw_value)

    if not isinstance(raw_value, int) or raw_value < 1:
        raise ValueError("Refresh token expiration must be a positive integer.")

    return raw_value


def _build_payload(
    user_id,
    username,
    token_type: str,
    lifetime_value: int | str,
) -> dict:
    issued_at = now_utc()
    payload = {
        "user_id": user_id,
        "user_name": username,
        "token_type": token_type,
        "issued_at": issued_at.isoformat(),
    }

    if lifetime_value == "inf":
        payload["expiration"] = "inf"
        return payload

    expires_at = issued_at + timedelta(days=lifetime_value)
    payload["expiration"] = expires_at.isoformat()
    payload["exp"] = expires_at
    return payload


def create_access_token(user_id, username, lifetime_value=None) -> str:
    normalized_lifetime = normalize_access_lifetime(lifetime_value)
    payload = _build_payload(
        user_id,
        username,
        TOKEN_TYPE_ACCESS,
        normalized_lifetime,
    )
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.AUTH_TOKEN_ALGORITHM,
    )


def create_refresh_token(user_id, username, lifetime_days=None) -> str:
    normalized_lifetime = normalize_refresh_lifetime_days(lifetime_days)
    payload = _build_payload(
        user_id,
        username,
        TOKEN_TYPE_REFRESH,
        normalized_lifetime,
    )
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.AUTH_TOKEN_ALGORITHM,
    )


def create_token(userid, username, timeInDays):
    return create_access_token(userid, username, timeInDays)


def decode_token(token):
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.AUTH_TOKEN_ALGORITHM],
    )


def _parse_bearer_token(request) -> str | None:
    auth = get_authorization_header(request).decode()
    if not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1]


def get_request_token(
    request,
    *,
    cookie_name: str,
    prefer_cookie: bool = False,
) -> str | None:
    header_token = _parse_bearer_token(request)
    cookie_token = request.COOKIES.get(cookie_name)

    if prefer_cookie:
        return cookie_token or header_token

    return header_token or cookie_token


def get_access_token_from_request(request, *, prefer_cookie: bool = False) -> str | None:
    return get_request_token(
        request,
        cookie_name=settings.AUTH_ACCESS_TOKEN_COOKIE_NAME,
        prefer_cookie=prefer_cookie,
    )


def get_refresh_token_from_request(request, *, prefer_cookie: bool = True) -> str | None:
    return request.COOKIES.get(settings.AUTH_REFRESH_TOKEN_COOKIE_NAME)


def get_token_expiration(payload: dict) -> datetime | None:
    expiration_value = payload.get("expiration")
    if not expiration_value:
        raise AuthenticationFailed("Invalid token: Missing expiration.")

    if expiration_value == "inf":
        return None

    try:
        expiration = datetime.fromisoformat(expiration_value)
    except ValueError as exc:
        raise AuthenticationFailed("Invalid token: Invalid expiration.") from exc

    if expiration.tzinfo is None:
        expiration = expiration.replace(tzinfo=timezone.utc)

    return expiration


def ensure_token_not_expired(payload: dict) -> dict:
    expiration = get_token_expiration(payload)
    if expiration is not None and expiration < now_utc():
        raise AuthenticationFailed("Token expired")
    return payload


def validate_token_payload(
    payload: dict,
    *,
    expected_token_type: str | None = None,
    allow_legacy: bool = False,
) -> dict:
    user_id = payload.get("user_id")
    user_name = payload.get("user_name")

    if not user_id or not user_name:
        raise AuthenticationFailed("Invalid token payload.")

    token_type = payload.get("token_type")
    if expected_token_type is not None:
        if token_type is None and not allow_legacy:
            raise AuthenticationFailed("Invalid token payload.")
        if token_type is not None and token_type != expected_token_type:
            raise AuthenticationFailed("Invalid token type.")

    return ensure_token_not_expired(payload)


def fetch_user_auth_context(user_id) -> dict | None:
    conn = database.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                usr_login,
                usr_admin,
                jwt_expiration,
                COALESCE(usr_tasy, FALSE)
            FROM usr_info
            WHERE usr_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None

        is_tasy = bool(row[3])
        return {
            "user_name": normalize_tasy_username(row[0]) if is_tasy else row[0],
            "is_admin": bool(row[1]),
            "jwt_expiration": serialize_access_lifetime(row[2]),
        }
    finally:
        cur.close()
        conn.close()


def get_access_cookie_max_age(lifetime_value) -> int:
    normalized_lifetime = normalize_access_lifetime(lifetime_value)
    if normalized_lifetime == "inf":
        return settings.AUTH_INFINITE_TOKEN_COOKIE_MAX_AGE_SECONDS
    return normalized_lifetime * 24 * 60 * 60


def _build_cookie_options(max_age: int) -> dict:
    return {
        "httponly": settings.AUTH_COOKIE_HTTPONLY,
        "secure": settings.AUTH_COOKIE_SECURE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": settings.AUTH_COOKIE_PATH,
        "max_age": max_age,
    }


def get_remaining_cookie_max_age(payload: dict, fallback_seconds: int) -> int:
    expiration = get_token_expiration(payload)
    if expiration is None:
        return fallback_seconds

    remaining_seconds = int((expiration - now_utc()).total_seconds())
    return max(0, remaining_seconds)


def set_access_token_cookie(response, token: str, lifetime_value) -> None:
    response.set_cookie(
        key=settings.AUTH_ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        **_build_cookie_options(get_access_cookie_max_age(lifetime_value)),
    )


def set_refresh_token_cookie(response, token: str, *, payload: dict | None = None) -> None:
    default_max_age = normalize_refresh_lifetime_days() * 24 * 60 * 60
    max_age = (
        get_remaining_cookie_max_age(payload, default_max_age)
        if payload is not None
        else default_max_age
    )
    response.set_cookie(
        key=settings.AUTH_REFRESH_TOKEN_COOKIE_NAME,
        value=token,
        **_build_cookie_options(max_age),
    )


def clear_auth_cookies(response) -> None:
    for cookie_name in (
        settings.AUTH_ACCESS_TOKEN_COOKIE_NAME,
        settings.AUTH_REFRESH_TOKEN_COOKIE_NAME,
    ):
        response.delete_cookie(
            cookie_name,
            path=settings.AUTH_COOKIE_PATH,
            domain=settings.AUTH_COOKIE_DOMAIN,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )


def get_admin_user_from_token(request):
    token = get_access_token_from_request(request)
    if not token:
        raise APIException("Authentication credentials were not provided.")

    try:
        payload = validate_token_payload(
            decode_token(token),
            expected_token_type=TOKEN_TYPE_ACCESS,
            allow_legacy=True,
        )
        user_id = payload.get("user_id")
        user_context = fetch_user_auth_context(user_id)
        if not user_context:
            raise AuthenticationFailed("User not found")

        if not user_context["is_admin"]:
            raise AuthenticationFailed("Admin privileges required.")

        return {
            "user_id": user_id,
            "user_name": user_context["user_name"],
            "is_admin": True,
        }
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed("Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationFailed("Invalid token")
    except AuthenticationFailed as exc:
        raise exc
    except Exception as exc:
        print(f"Admin Auth Error: {exc}")
        raise APIException("An error occurred during token validation.")
