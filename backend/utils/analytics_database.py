from rest_framework.exceptions import APIException
import psycopg2

from utils.env import env, env_int

ANALYTICS_DATABASE_URL = env(
    "AUTH_ANALYTICS_DATABASE_URL",
    "postgresql://postgres:postgres@192.168.1.16:5432/auth_gateway",
)
ANALYTICS_DB_CONNECT_TIMEOUT = env_int("AUTH_ANALYTICS_DB_CONNECT_TIMEOUT", 5)


def get_analytics_db_connection():
    try:
        return psycopg2.connect(
            ANALYTICS_DATABASE_URL,
            connect_timeout=ANALYTICS_DB_CONNECT_TIMEOUT,
        )
    except psycopg2.Error as exc:
        raise APIException(f"Analytics database connection error: {exc}") from exc
