from rest_framework.exceptions import APIException
import psycopg2
from utils.env import env, env_int

DB_HOST = env("DJANGO_DB_HOST", "192.168.1.64")
DB_PORT = env_int("DJANGO_DB_PORT", 5432)
DB_NAME = env("DJANGO_DB_NAME", "auth_service")
DB_USER = env("DJANGO_DB_USER", "postgres")
DB_PASSWORD = env("DJANGO_DB_PASSWORD", "postgres")
DB_CONNECT_TIMEOUT = env_int("DJANGO_DB_CONNECT_TIMEOUT", 5)

def get_db_connection():
    try:
        connection = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=DB_CONNECT_TIMEOUT,
        )
        return connection
    except psycopg2.Error as e:
        print(f"Database conection error: {e}")
        raise APIException(f"Database conection error: {e}")
