from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

import psycopg2
import logging

from utils.database import get_db_connection
from utils.jwt import get_admin_user_from_token

from .reference import HEADER_DEFAULT, FOOTER_DEFAULT
from .nginx_builder import NginxConfigBuilder
from infrastructure.managers import SshManager

logger = logging.getLogger(__name__)


SSH_HOST = "192.168.2.131"
SSH_PORT = 22
SSH_USER = "luis"
SSH_PASSWORD = "123Mudar"

class NginxConfigGeneratorView(APIView):
    """Generate nginx configuration from services."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            logger.warning(f"Admin authentication failed for nginx config generation: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()

        try:
            logger.info("Fetching services data for nginx configuration generation")
            cur.execute("""
                SELECT 
                    si.srv_id,
                    si.rt_frontend_block,
                    si.rt_backend_block,
                    si.rt_enabled,
                    si.srv_name
                FROM services_info si
                WHERE si.rt_enabled = true
                ORDER BY si.srv_id
            """)
            
            result = cur.fetchall()
            
            if not result:
                logger.warning("No enabled services found for nginx configuration")
                return Response(
                    {"detail": "No enabled services found"},
                    status=status.HTTP_204_NO_CONTENT
                )
            
            logger.debug(f"Retrieved {len(result)} services from database")
            services_data = [
                {
                    'srv_id': row[0],
                    'rt_frontend_block': row[1],
                    'rt_backend_block': row[2],
                    'rt_enabled': row[3],
                    'srv_name': row[4],
                }
                for row in result
            ]
            
            header = request.query_params.get('header', HEADER_DEFAULT)
            footer = request.query_params.get('footer', FOOTER_DEFAULT)
            
            logger.debug(f"Building nginx config with {len(services_data)} services")
            nginx_config = NginxConfigBuilder.build_nginx_config(
                services_data=services_data,
                header=header,
                footer=footer,
            )
            
            logger.info(f"Nginx configuration generated successfully with {len(services_data)} services")
            return Response({
                "message": "Nginx configuration generated successfully",
                "config": nginx_config,
                "services_count": len(services_data),
            }, status=status.HTTP_200_OK)

        except psycopg2.Error as e:
            logger.error(f"Database query execution failed during nginx config generation: {str(e)}", exc_info=True)
            raise APIException(f"Query execution failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during nginx config generation: {str(e)}", exc_info=True)
            raise
        finally:
            cur.close()
            conn.close()


class NginxConfigDeployView(APIView):
    permission_classes = [IsAuthenticated]
    REMOTE_CONFIG_PATH = "/etc/nginx/sites-available/api-gateway.conf"

    def post(self, request: Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            logger.warning(f"Admin authentication failed for nginx config deployment: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)
        
        config_text = request.data.get("config")
        ssh_host = SSH_HOST
        ssh_username = SSH_USER
        ssh_password = SSH_PASSWORD
        ssh_key_path = None
        ssh_port = SSH_PORT

        try:
            ssh_port = int(ssh_port)
        except (TypeError, ValueError):
            return Response({"detail": "ssh_port must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not config_text or not ssh_host or not ssh_username or (not ssh_password and not ssh_key_path):
            return Response(
                {"detail": "config, ssh_host, ssh_username and either ssh_password or ssh_key_path are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conn = get_db_connection()
        cur = conn.cursor()
        conf_id = None

        try:
            cur.execute(
                "INSERT INTO services_conf_log (conf_text, conf_status) VALUES (%s, %s) RETURNING conf_id",
                (config_text, "pending"),
            )
            conf_id = cur.fetchone()[0]
            conn.commit()

            ssh_manager = SshManager(
                hostname=ssh_host,
                username=ssh_username,
                password=ssh_password,
                port=ssh_port,
                key_filename=ssh_key_path,
            )
            deploy_result = ssh_manager.deploy_nginx_config(
                config_text=config_text,
                remote_path=self.REMOTE_CONFIG_PATH,
            )

            status_label = "passed" if deploy_result["syntax_status"] and deploy_result["test_status"] else "failed"
            conf_status = f"{status_label}: {deploy_result['output'][:500]}"
            cur.execute(
                "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
                (conf_status, conf_id),
            )
            conn.commit()

            response_status = status.HTTP_200_OK if status_label == "passed" else status.HTTP_400_BAD_REQUEST
            return Response(
                {
                    "message": "Configuration deployed" if status_label == "passed" else "Configuration deployment failed",
                    "conf_id": conf_id,
                    "status_label": status_label,
                    "deployment": deploy_result,
                },
                status=response_status,
            )
        except Exception as e:
            if conf_id:
                cur.execute(
                    "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
                    (f"failed: {str(e)}", conf_id),
                )
                conn.commit()
            logger.error(f"Nginx configuration deployment failed: {str(e)}", exc_info=True)
            raise
        finally:
            cur.close()
            conn.close()


class NginxConfigRestoreView(APIView):
    permission_classes = [IsAuthenticated]
    REMOTE_CONFIG_PATH = NginxConfigDeployView.REMOTE_CONFIG_PATH

    def post(self, request: Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            logger.warning(f"Admin authentication failed for nginx config restore: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)

        ssh_host = SSH_HOST
        ssh_username = SSH_USER
        ssh_password = SSH_PASSWORD
        ssh_key_path = None
        ssh_port = SSH_PORT
        try:
            ssh_port = int(ssh_port)
        except (TypeError, ValueError):
            return Response({"detail": "ssh_port must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        conn = get_db_connection()
        cur = conn.cursor()
        conf_id = None
        restored_from = None

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
                logger.warning("No successful configuration found to restore")
                return Response(
                    {"detail": "No successful configuration found to restore"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            restored_from, config_text = row
            cur.execute(
                "INSERT INTO services_conf_log (conf_text, conf_status) VALUES (%s, %s) RETURNING conf_id",
                (config_text, f"restore_pending (source={restored_from})"),
            )
            conf_id = cur.fetchone()[0]
            conn.commit()

            ssh_manager = SshManager(
                hostname=ssh_host,
                username=ssh_username,
                password=ssh_password,
                port=ssh_port,
                key_filename=ssh_key_path,
            )
            deploy_result = ssh_manager.deploy_nginx_config(
                config_text=config_text,
                remote_path=self.REMOTE_CONFIG_PATH,
            )

            status_label = "passed" if deploy_result["syntax_status"] and deploy_result["test_status"] else "failed"
            conf_status = f"restore_{status_label}: {deploy_result['output'][:500]}"
            cur.execute(
                "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
                (conf_status, conf_id),
            )
            conn.commit()

            response_status = status.HTTP_200_OK if status_label == "passed" else status.HTTP_400_BAD_REQUEST
            return Response(
                {
                    "message": "Configuration restored" if status_label == "passed" else "Configuration restore failed",
                    "conf_id": conf_id,
                    "restored_from": restored_from,
                    "status_label": status_label,
                    "deployment": deploy_result,
                },
                status=response_status,
            )
        except Exception as e:
            if conf_id:
                cur.execute(
                    "UPDATE services_conf_log SET conf_status=%s WHERE conf_id=%s",
                    (f"restore_failed: {str(e)}", conf_id),
                )
                conn.commit()
            logger.error(f"Nginx configuration restore failed: {str(e)}", exc_info=True)
            raise
        finally:
            cur.close()
            conn.close()