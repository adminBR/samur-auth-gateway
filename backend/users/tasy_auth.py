import logging

import requests

from utils.env import env, env_int

logger = logging.getLogger(__name__)

TASY_AUTH_API_URL = env("TASY_AUTH_API_URL")
TASY_AUTH_DB_ID = env("TASY_AUTH_DB_ID")
TASY_AUTH_PASSKEY = env("TASY_AUTH_PASSKEY")
TASY_AUTH_TIMEOUT_SECONDS = env_int("TASY_AUTH_TIMEOUT_SECONDS", 10)


def normalize_tasy_username(username: str) -> str:
    return str(username or "").strip().upper()


class TasyAuthError(Exception):
    """Raised when the Tasy auth bridge cannot complete the verification flow."""


class TasyAuthConfigurationError(TasyAuthError):
    """Raised when the Tasy auth bridge is not configured."""


def is_tasy_auth_configured() -> bool:
    return all((TASY_AUTH_API_URL, TASY_AUTH_DB_ID, TASY_AUTH_PASSKEY))


def _ensure_tasy_auth_configured() -> None:
    if is_tasy_auth_configured():
        return

    raise TasyAuthConfigurationError(
        "Tasy authentication is not configured. Set TASY_AUTH_API_URL, "
        "TASY_AUTH_DB_ID, and TASY_AUTH_PASSKEY."
    )


def _escape_oracle_literal(value: str) -> str:
    return str(value).replace("'", "''")


def _extract_row_value(row, *keys: str, index: int = 0):
    if isinstance(row, dict):
        for key in keys:
            if key in row and row[key] is not None:
                return row[key]

        if row:
            return next(iter(row.values()))

        return None

    if isinstance(row, (list, tuple)):
        return row[index] if len(row) > index else None

    return None


def _run_tasy_query(query: str):
    _ensure_tasy_auth_configured()

    payload = {
        "query": query,
        "db_id": TASY_AUTH_DB_ID,
        "passkey": TASY_AUTH_PASSKEY,
    }

    try:
        response = requests.post(
            TASY_AUTH_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=TASY_AUTH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.error("Tasy authentication bridge request failed: %s", exc)
        raise TasyAuthError(
            "Failed to contact the Tasy authentication service."
        ) from exc

    rows = data.get("rows") or data.get("data") or []
    return rows[0] if rows else None


def _fetch_tasy_user_credentials(username: str):
    normalized_username = normalize_tasy_username(username)
    if not normalized_username:
        return None

    escaped_username = _escape_oracle_literal(normalized_username)
    query_user = f"""
        SELECT ds_login, nm_usuario, ds_senha, ds_tec
        FROM usuario
        WHERE UPPER(TRIM(ds_login)) = '{escaped_username}'
           OR UPPER(TRIM(nm_usuario)) = '{escaped_username}'
    """

    user_row = _run_tasy_query(query_user)
    if not user_row:
        return None

    canonical_username = normalize_tasy_username(
        _extract_row_value(user_row, "ds_login", "nm_usuario", index=0)
    )
    alternate_username = normalize_tasy_username(
        _extract_row_value(user_row, "nm_usuario", index=1)
    )
    lookup_usernames = []
    for candidate_username in (canonical_username, alternate_username):
        if candidate_username and candidate_username not in lookup_usernames:
            lookup_usernames.append(candidate_username)

    stored_hash = _extract_row_value(user_row, "ds_senha", index=2)
    salt = _extract_row_value(user_row, "ds_tec", index=3)

    if not canonical_username:
        raise TasyAuthError("Missing Tasy username in the authentication response.")

    return {
        "normalized_username": normalized_username,
        "canonical_username": canonical_username,
        "lookup_usernames": lookup_usernames,
        "stored_hash": stored_hash,
        "salt": salt,
    }


def authenticate_tasy_user_with_identity(username: str, password: str):
    normalized_password = str(password or "")
    if normalized_password == "":
        return False, None

    user_credentials = _fetch_tasy_user_credentials(username)
    if not user_credentials:
        logger.info(
            "Tasy user '%s' was not found.",
            normalize_tasy_username(username),
        )
        return False, None

    canonical_username = user_credentials["canonical_username"]
    stored_hash = user_credentials["stored_hash"]
    salt = user_credentials["salt"]

    if not stored_hash or not salt:
        raise TasyAuthError(
            "Missing user credentials in the Tasy authentication response."
        )

    logger.debug(
        "Matched Tasy username '%s' for normalized login '%s'.",
        canonical_username,
        user_credentials["normalized_username"],
    )

    escaped_password = _escape_oracle_literal(normalized_password)
    escaped_salt = _escape_oracle_literal(str(salt))
    query_hash = f"""
        SELECT STANDARD_HASH(
            UPPER('{escaped_password}') || '{escaped_salt}',
            'SHA256'
        ) AS computed_hash
        FROM dual
    """

    hash_row = _run_tasy_query(query_hash)
    if not hash_row:
        raise TasyAuthError("Failed to compute the Tasy password hash.")

    computed_hash = _extract_row_value(hash_row, "computed_hash", index=0)
    if not computed_hash:
        raise TasyAuthError(
            "Missing computed hash in the Tasy authentication response."
        )

    is_valid = str(computed_hash).strip().upper() == str(stored_hash).strip().upper()
    return is_valid, {
        "canonical_username": canonical_username,
        "lookup_usernames": user_credentials["lookup_usernames"],
    }


def authenticate_tasy_user(username: str, password: str) -> bool:
    is_valid, _identity = authenticate_tasy_user_with_identity(username, password)
    return is_valid
