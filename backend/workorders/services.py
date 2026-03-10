import requests
from dataclasses import dataclass
from typing import Any, Dict

import requests


#DB_PROXY_URL = "http://192.168.1.16:1111/api/v1/run_query"
DB_PROXY_URL = "http://192.168.1.7:1111/api/v1/run_query"

@dataclass(frozen=True)
class DbProxySettings:
    database: str
    database_name: str
    passkey: str


DB_PROXY_BODY = DbProxySettings(
    database="oracle",
    database_name="tasy",
    passkey="123mudar",
)


def execute_db_proxy(query: str) -> Dict[str, Any]:
    payload = {
        "database": DB_PROXY_BODY.database,
        "database_name": DB_PROXY_BODY.database_name,
        "passkey": DB_PROXY_BODY.passkey,
        "query": query,
    }
    response = requests.post(DB_PROXY_URL, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()
