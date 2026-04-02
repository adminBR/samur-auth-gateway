from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging

from psycopg2.extras import RealDictCursor
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.analytics_database import get_analytics_db_connection
from utils.database import get_db_connection
from utils.jwt import get_admin_user_from_token

logger = logging.getLogger(__name__)

DEFAULT_LOOKBACK_HOURS = 24


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def parse_request_datetime(raw_value: str | None, field_name: str) -> datetime | None:
    if raw_value in (None, ""):
        return None

    normalized = raw_value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationError(
            {"detail": f"Invalid '{field_name}' datetime. Use ISO 8601 format."}
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def resolve_time_range(request) -> tuple[datetime, datetime]:
    end = parse_request_datetime(request.query_params.get("end"), "end") or now_utc()
    start = parse_request_datetime(request.query_params.get("start"), "start")

    if start is None:
        start = end - timedelta(hours=DEFAULT_LOOKBACK_HOURS)

    if start >= end:
        raise ValidationError({"detail": "'start' must be earlier than 'end'."})

    return start, end


def bucket_key(value: datetime) -> str:
    return (
        value.astimezone(timezone.utc)
        .replace(minute=0, second=0, microsecond=0)
        .isoformat()
    )


def build_detail_row(row: dict) -> dict[str, int | str]:
    return {
        "user_id": str(row["user_id"]),
        "user_name": str(row["user_name"] or "-"),
        "client_ip": str(row["client_ip"] or "-"),
        "access_count": int(row["access_count"]),
    }


def create_empty_buckets(bucket_keys: list[str]) -> list[dict]:
    return [{"bucket_start": key, "count": 0, "details": []} for key in bucket_keys]


def fetch_service_names() -> dict[int, str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT srv_id, srv_name FROM services_info ORDER BY srv_name, srv_id")
        rows = cur.fetchall()
        return {int(row[0]): str(row[1]) for row in rows}
    finally:
        cur.close()
        conn.close()


def ensure_service_series(
    services_by_id: dict[int, dict],
    bucket_keys: list[str],
    service_id: int,
    service_name: str,
) -> dict:
    if service_id not in services_by_id:
        services_by_id[service_id] = {
            "service_id": service_id,
            "service_name": service_name,
            "total_count": 0,
            "buckets": create_empty_buckets(bucket_keys),
        }

    return services_by_id[service_id]


def build_bucket_lookup(series: dict) -> dict[str, dict]:
    return {bucket["bucket_start"]: bucket for bucket in series["buckets"]}


class AdminAuthAccessAnalyticsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            admin_user = get_admin_user_from_token(request)
        except APIException as exc:
            logger.warning("Admin authentication failed for analytics: %s", exc.detail)
            return Response({"detail": exc.detail}, status=exc.status_code)

        start, end = resolve_time_range(request)
        logger.info(
            "Admin %s fetching auth analytics for range %s -> %s",
            admin_user["user_id"],
            start.isoformat(),
            end.isoformat(),
        )

        service_names = fetch_service_names()
        analytics_conn = get_analytics_db_connection()
        analytics_cur = analytics_conn.cursor(cursor_factory=RealDictCursor)

        # The raw table stores non-authenticated or unresolved rows as user_id='-'
        # with service_id=NULL, so the analytics page focuses only on real accesses.
        where_clause = """
            FROM public.raw_api_access_logs
            WHERE request_time >= %s
              AND request_time <= %s
              AND user_id IS NOT NULL
              AND user_id <> '-'
              AND service_id IS NOT NULL
        """

        try:
            analytics_cur.execute(
                """
                SELECT generate_series(
                    date_trunc('hour', %s::timestamptz),
                    date_trunc('hour', %s::timestamptz),
                    interval '1 hour'
                ) AS bucket_start
                """,
                (start, end),
            )
            bucket_keys = [bucket_key(row["bucket_start"]) for row in analytics_cur.fetchall()]

            global_buckets = create_empty_buckets(bucket_keys)
            global_bucket_lookup = {
                bucket["bucket_start"]: bucket for bucket in global_buckets
            }

            services_by_id = {
                service_id: {
                    "service_id": service_id,
                    "service_name": service_name,
                    "total_count": 0,
                    "buckets": create_empty_buckets(bucket_keys),
                }
                for service_id, service_name in service_names.items()
            }
            service_bucket_lookups = {
                service_id: build_bucket_lookup(series)
                for service_id, series in services_by_id.items()
            }

            analytics_cur.execute(
                f"""
                SELECT
                    date_trunc('hour', request_time) AS bucket_start,
                    COUNT(*) AS access_count
                {where_clause}
                GROUP BY 1
                ORDER BY 1
                """,
                (start, end),
            )
            for row in analytics_cur.fetchall():
                current_bucket = global_bucket_lookup.get(bucket_key(row["bucket_start"]))
                if current_bucket is not None:
                    current_bucket["count"] = int(row["access_count"])

            analytics_cur.execute(
                f"""
                SELECT
                    date_trunc('hour', request_time) AS bucket_start,
                    user_id,
                    user_name,
                    HOST(client_ip) AS client_ip,
                    COUNT(*) AS access_count
                {where_clause}
                GROUP BY 1, 2, 3, 4
                ORDER BY 1, 5 DESC, 2, 3, 4
                """,
                (start, end),
            )
            for row in analytics_cur.fetchall():
                current_bucket = global_bucket_lookup.get(bucket_key(row["bucket_start"]))
                if current_bucket is not None:
                    current_bucket["details"].append(build_detail_row(row))

            analytics_cur.execute(
                f"""
                SELECT
                    service_id,
                    date_trunc('hour', request_time) AS bucket_start,
                    COUNT(*) AS access_count
                {where_clause}
                GROUP BY 1, 2
                ORDER BY 1, 2
                """,
                (start, end),
            )
            for row in analytics_cur.fetchall():
                service_id = int(row["service_id"])
                service_name = service_names.get(service_id, f"Service {service_id}")
                service_series = ensure_service_series(
                    services_by_id,
                    bucket_keys,
                    service_id,
                    service_name,
                )
                service_bucket_lookups.setdefault(
                    service_id,
                    build_bucket_lookup(service_series),
                )
                current_bucket = service_bucket_lookups[service_id].get(
                    bucket_key(row["bucket_start"])
                )
                if current_bucket is None:
                    continue
                current_bucket["count"] = int(row["access_count"])
                service_series["total_count"] += int(row["access_count"])

            analytics_cur.execute(
                f"""
                SELECT
                    service_id,
                    date_trunc('hour', request_time) AS bucket_start,
                    user_id,
                    user_name,
                    HOST(client_ip) AS client_ip,
                    COUNT(*) AS access_count
                {where_clause}
                GROUP BY 1, 2, 3, 4, 5
                ORDER BY 1, 2, 6 DESC, 3, 4, 5
                """,
                (start, end),
            )
            for row in analytics_cur.fetchall():
                service_id = int(row["service_id"])
                service_name = service_names.get(service_id, f"Service {service_id}")
                service_series = ensure_service_series(
                    services_by_id,
                    bucket_keys,
                    service_id,
                    service_name,
                )
                service_bucket_lookups.setdefault(
                    service_id,
                    build_bucket_lookup(service_series),
                )
                target_bucket_key = bucket_key(row["bucket_start"])
                target_bucket = service_bucket_lookups[service_id].get(target_bucket_key)
                if target_bucket is not None:
                    target_bucket["details"].append(build_detail_row(row))

            global_total = sum(int(bucket["count"]) for bucket in global_buckets)
            services = sorted(
                services_by_id.values(),
                key=lambda service: (-int(service["total_count"]), service["service_name"]),
            )

            return Response(
                {
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "global": {
                        "total_count": global_total,
                        "buckets": global_buckets,
                    },
                    "services": services,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            logger.error("Error generating auth analytics: %s", str(exc), exc_info=True)
            raise APIException({"detail": f"Analytics query error: {exc}"})
        finally:
            analytics_cur.close()
            analytics_conn.close()
