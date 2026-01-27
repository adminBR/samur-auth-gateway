from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

import psycopg2
from utils.database import get_db_connection
from utils.jwt import get_admin_user_from_token

from .reference import HEADER_DEFAULT, FOOTER_DEFAULT
from .nginx_builder import NginxConfigBuilder


class NginxConfigGeneratorView(APIView):
    """Generate nginx configuration from services."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                SELECT 
                    si.srv_id,
                    si.rt_location_path,
                    si.rt_proxy_pass,
                    si.rt_proxy_params,
                    si.rt_custom_params,
                    api.rt_location_path as api_rt_location_path,
                    api.rt_proxy_pass as api_rt_proxy_pass,
                    api.rt_proxy_params as api_rt_proxy_params,
                    api.rt_custom_params as api_rt_custom_params,
                    si.srv_name
                FROM services_info si
                LEFT JOIN services_api_info api ON si.srv_id = api.srv_id
                WHERE si.rt_location_path IS NOT NULL OR api.rt_location_path IS NOT NULL
                ORDER BY si.srv_id
            """)
            
            result = cur.fetchall()
            
            if not result:
                return Response(
                    {"detail": "No services with location paths found"},
                    status=status.HTTP_204_NO_CONTENT
                )
            
            services_data = [
                {
                    'srv_id': row[0],
                    'rt_location_path': row[1],
                    'rt_proxy_pass': row[2],
                    'rt_proxy_params': row[3],
                    'rt_custom_params': row[4],
                    'rt_backend_location_path': row[5],
                    'rt_backend_proxy_pass': row[6],
                    'rt_backend_proxy_params': row[7],
                    'rt_backend_custom_params': row[8],
                    'srv_name': row[9],
                }
                for row in result
            ]
            
            header = request.query_params.get('header', HEADER_DEFAULT)
            footer = request.query_params.get('footer', FOOTER_DEFAULT)
            
            nginx_config = NginxConfigBuilder.build_nginx_config(
                services_data=services_data,
                header=header,
                footer=footer,
            )
            
            return Response({
                "message": "Nginx configuration generated successfully",
                "config": nginx_config,
                "services_count": len(services_data),
            }, status=status.HTTP_200_OK)

        except psycopg2.Error as e:
            raise APIException(f"Query execution failed: {e}")
        finally:
            cur.close()
            conn.close()