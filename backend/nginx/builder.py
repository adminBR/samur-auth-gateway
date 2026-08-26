import json
import logging
import queue
import threading
from typing import Callable, Dict, Optional, Tuple

import psycopg2
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from infrastructure.managers import SshManager
from utils.database import get_db_connection
from utils.env import env, env_int
from utils.jwt import get_admin_user_from_token

from .nginx_builder import NginxConfigBuilder
from .reference import load_header_template

logger = logging.getLogger(__name__)

SSH_HOST = env("NGINX_SSH_HOST", "") or ""
SSH_PORT = env_int("NGINX_SSH_PORT", 22)
SSH_USER = env("NGINX_SSH_USER", "") or ""
SSH_PASSWORD = env("NGINX_SSH_PASSWORD", "") or ""
SSH_KEY_PATH = env("NGINX_SSH_KEY_PATH", "") or ""
REMOTE_CONFIG_PATH = env(
    "NGINX_REMOTE_CONFIG_PATH",
    "/etc/nginx/sites-available/api-gateway.conf",
) or "/etc/nginx/sites-available/api-gateway.conf"
RESTART_COMMAND = env("NGINX_RESTART_COMMAND", "systemctl restart nginx") or "systemctl restart nginx"

ProgressCallback = Optional[Callable[[Dict[str, object]], None]]


def _authenticate_admin(request: Request) -> Optional[Response]:
    try:
        get_admin_user_from_token(request)
    except APIException as exc:
        logger.warning("Admin authentication failed for NGINX operation: %s", exc.detail)
        return Response({"detail": exc.detail}, status=exc.status_code)
    return None


def _ssh_configuration_error() -> Optional[str]:
    if not SSH_HOST or not SSH_USER or (not SSH_PASSWORD and not SSH_KEY_PATH):
        return (
            "NGINX SSH configuration is incomplete. Configure host, user and "
            "either password or key path."
        )
    try:
        int(SSH_PORT)
    except (TypeError, ValueError):
        return "NGINX_SSH_PORT must be an integer."
    return None


def _build_ssh_manager() -> SshManager:
    return SshManager(
        hostname=SSH_HOST,
        username=SSH_USER,
        password=SSH_PASSWORD,
        port=int(SSH_PORT),
        key_filename=SSH_KEY_PATH or None,
    )


def _deployment_status(deployment: Dict[str, object], *, restore: bool) -> str:
    if deployment.get("deployed"):
        label = "passed"
    elif deployment.get("rolled_back") and deployment.get("rollback_status"):
        label = "failed_rolled_back"
    elif deployment.get("rolled_back"):
        label = "failed_rollback"
    else:
        label = "failed"
    return f"restore_{label}" if restore else label


def _perform_deployment(
    config_text: str,
    *,
    restore: bool = False,
    restored_from: Optional[int] = None,
    on_progress: ProgressCallback = None,
) -> Tuple[Dict[str, object], int]:
    conn = get_db_connection()
    cur = conn.cursor()
    conf_id = None
    pending_status = (
        f"restore_pending (source={restored_from})" if restore else "pending"
    )

    try:
        cur.execute(
            "INSERT INTO services_conf_log (conf_text, conf_status) VALUES (%s, %s) RETURNING conf_id",
            (config_text, pending_status),
        )
        conf_id = cur.fetchone()[0]
        conn.commit()

        deployment = _build_ssh_manager().deploy_nginx_config(
            config_text=config_text,
            remote_path=REMOTE_CONFIG_PATH,
            restart_command=RESTART_COMMAND,
            on_progress=on_progress,
        )
        status_label = _deployment_status(deployment, restore=restore)
        history_status = f"{status_label}: {str(deployment.get('output', ''))[:500]}"
        cur.execute(
            "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
            (history_status, conf_id),
        )
        conn.commit()

        succeeded = bool(deployment.get("deployed"))
        if restore:
            message = (
                "Configuração anterior restaurada e NGINX reiniciado."
                if succeeded
                else "Não foi possível restaurar a configuração anterior."
            )
        else:
            message = (
                "Configuração publicada e NGINX reiniciado."
                if succeeded
                else (
                    "Teste reprovado; a configuração anterior foi restaurada."
                    if deployment.get("rollback_status")
                    else "Publicação falhou e a restauração automática precisa de atenção."
                )
            )

        response_status = status.HTTP_200_OK if succeeded else status.HTTP_400_BAD_REQUEST
        return (
            {
                "message": message,
                "conf_id": conf_id,
                "restored_from": restored_from,
                "status_label": "passed" if succeeded else "failed",
                "deployment": deployment,
                "remote_path": REMOTE_CONFIG_PATH,
            },
            response_status,
        )
    except Exception as exc:
        if conf_id:
            try:
                failure_status = "restore_failed" if restore else "failed"
                cur.execute(
                    "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
                    (f"{failure_status}: {str(exc)[:500]}", conf_id),
                )
                conn.commit()
            except Exception:
                conn.rollback()
        logger.error("NGINX deployment failed: %s", exc, exc_info=True)
        raise
    finally:
        cur.close()
        conn.close()


def generate_current_nginx_config(
    header: Optional[str] = None,
) -> Tuple[str, int]:
    """Build the current NGINX config from all enabled database services."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT si.srv_id, si.rt_frontend_block, si.rt_backend_block,
                   si.rt_enabled, si.srv_name
            FROM services_info si
            WHERE si.rt_enabled = true
            ORDER BY si.srv_id
            """
        )
        services_data = [
            {
                "srv_id": row[0],
                "rt_frontend_block": row[1],
                "rt_backend_block": row[2],
                "rt_enabled": row[3],
                "srv_name": row[4],
            }
            for row in cur.fetchall()
        ]
        nginx_config = NginxConfigBuilder.build_nginx_config(
            services_data=services_data,
            header=header if header is not None else load_header_template(),
        )
        return nginx_config, len(services_data)
    except psycopg2.Error as exc:
        logger.error("NGINX config query failed: %s", exc, exc_info=True)
        raise APIException(f"Query execution failed: {exc}") from exc
    finally:
        cur.close()
        conn.close()


def publish_current_nginx_config() -> Tuple[Dict[str, object], int]:
    """Generate, deploy, validate, and restart the current NGINX config."""
    config_error = _ssh_configuration_error()
    if config_error:
        return (
            {
                "message": config_error,
                "status_label": "failed",
            },
            status.HTTP_400_BAD_REQUEST,
        )

    config_text, services_count = generate_current_nginx_config()
    result, response_status = _perform_deployment(config_text)
    result["services_count"] = services_count
    return result, response_status


def _latest_working_config() -> Tuple[int, str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT conf_id, conf_text
            FROM services_conf_log
            WHERE conf_status ILIKE 'passed%%'
            ORDER BY conf_id DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row or not row[1]:
            raise LookupError("No successful configuration found to restore")
        return row[0], row[1]
    finally:
        cur.close()
        conn.close()


def _stream_operation(operation: Callable[[ProgressCallback], Tuple[Dict[str, object], int]]):
    event_queue: queue.Queue = queue.Queue()
    finished = object()

    def emit_step(step: Dict[str, object]) -> None:
        event_queue.put({"type": "step", "step": step})

    def worker() -> None:
        try:
            result, response_status = operation(emit_step)
            event_queue.put(
                {
                    "type": "complete",
                    "ok": response_status < 400,
                    "result": result,
                }
            )
        except Exception as exc:
            event_queue.put(
                {
                    "type": "complete",
                    "ok": False,
                    "result": {
                        "status_label": "failed",
                        "message": str(exc),
                    },
                }
            )
        finally:
            event_queue.put(finished)

    def event_stream():
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while True:
            event = event_queue.get()
            if event is finished:
                break
            yield f"{json.dumps(event, ensure_ascii=False)}\n"

    response = StreamingHttpResponse(
        event_stream(),
        content_type="application/x-ndjson; charset=utf-8",
    )
    response["Cache-Control"] = "no-cache, no-store"
    response["X-Accel-Buffering"] = "no"
    return response


class NginxConfigGeneratorView(APIView):
    """Generate NGINX configuration from enabled services."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        auth_error = _authenticate_admin(request)
        if auth_error:
            return auth_error

        nginx_config, services_count = generate_current_nginx_config(
            header=request.query_params.get("header") or None,
        )
        return Response(
            {
                "message": "Nginx configuration generated successfully",
                "config": nginx_config,
                "services_count": services_count,
            }
        )


class NginxConfigDeployView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        auth_error = _authenticate_admin(request)
        if auth_error:
            return auth_error
        config_text = request.data.get("config")
        if not config_text:
            return Response({"detail": "config is required"}, status=status.HTTP_400_BAD_REQUEST)
        config_error = _ssh_configuration_error()
        if config_error:
            return Response({"detail": config_error}, status=status.HTTP_400_BAD_REQUEST)

        result, response_status = _perform_deployment(config_text)
        return Response(result, status=response_status)


class NginxConfigDeployStreamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        auth_error = _authenticate_admin(request)
        if auth_error:
            return auth_error
        config_text = request.data.get("config")
        if not config_text:
            return Response({"detail": "config is required"}, status=status.HTTP_400_BAD_REQUEST)
        config_error = _ssh_configuration_error()
        if config_error:
            return Response({"detail": config_error}, status=status.HTTP_400_BAD_REQUEST)

        return _stream_operation(
            lambda on_progress: _perform_deployment(
                config_text,
                on_progress=on_progress,
            )
        )


class NginxConfigRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        auth_error = _authenticate_admin(request)
        if auth_error:
            return auth_error
        config_error = _ssh_configuration_error()
        if config_error:
            return Response({"detail": config_error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            restored_from, config_text = _latest_working_config()
        except LookupError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        result, response_status = _perform_deployment(
            config_text,
            restore=True,
            restored_from=restored_from,
        )
        return Response(result, status=response_status)


class NginxConfigRestoreStreamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        auth_error = _authenticate_admin(request)
        if auth_error:
            return auth_error
        config_error = _ssh_configuration_error()
        if config_error:
            return Response({"detail": config_error}, status=status.HTTP_400_BAD_REQUEST)

        def restore(on_progress: ProgressCallback):
            restored_from, config_text = _latest_working_config()
            return _perform_deployment(
                config_text,
                restore=True,
                restored_from=restored_from,
                on_progress=on_progress,
            )

        return _stream_operation(restore)
