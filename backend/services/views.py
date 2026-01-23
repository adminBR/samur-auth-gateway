from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError,APIException
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FileUploadParser,FormParser # For file uploads

import psycopg2
from datetime import datetime,timedelta,timezone

from .serializers import addServiceSerializer,updateServiceSerializer
from utils.database import get_db_connection
from utils.jwt import get_admin_user_from_token

import os
import base64
import paramiko
from paramiko import SSHClient
from .nginx_builder import NginxConfigBuilder

from .reference import HEADER_DEFAULT,FOOTER_DEFAULT

class SshManager(APIView):
    def get(self, request: Request):
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(hostname="192.168.1.64", username="ti", password="123Mudar")
        except:
            print("cant connect!")
            raise APIException("Can't connect to ssh.")

        stdin, stdout, stderr = client.exec_command('echo {} | sudo -S nginx -t'.format("123Mudar"))
        return_string = stderr.read().decode()
        #print(return_string)
        client.close()
        return Response({
            "syntax_status": False if return_string.find("nginx: the configuration file /etc/nginx/nginx.conf syntax is ok") == -1 else True,
            "test_status": False if return_string.find("nginx: configuration file /etc/nginx/nginx.conf test is successful") == -1 else True
            })
        
        

class ServicesManager(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request):
        
        user_id = request.user.id
        conn = get_db_connection()
        cur = conn.cursor()
        print(user_id)
        try:
            cur.execute("SELECT usr_access FROM usr_info ui WHERE ui.usr_id = %s", (user_id,))
            result = cur.fetchone()
            user_services = result[0]

            cur.execute(f"SELECT * FROM services_info si WHERE si.srv_id IN ({user_services}) order by si.srv_id")
            result = cur.fetchall()
            services_list = []
            for row in result:
                srv_id = row[0]
                # Fetch API config for this service
                cur.execute(
                    "SELECT rt_location_path, rt_proxy_pass, rt_proxy_params, rt_custom_params FROM services_api_info WHERE srv_id = %s",
                    (srv_id,)
                )
                api_result = cur.fetchone()
                
                service_data = {
                    "srv_id": row[0],
                    "srv_image": base64.b64encode(row[1]).decode('utf-8') if row[1] else None,
                    "srv_name": row[2],
                    "srv_ip": row[3],
                    "srv_desc": row[4],
                    "rt_location_path": row[5],
                    "rt_proxy_pass": row[6],
                    "rt_proxy_params": row[7],
                    "rt_custom_params": row[8],
                }
                
                # Add API fields if they exist
                if api_result:
                    service_data["rt_backend_location_path"] = api_result[0]
                    service_data["rt_backend_proxy_pass"] = api_result[1]
                    service_data["rt_backend_proxy_params"] = api_result[2]
                    service_data["rt_backend_custom_params"] = api_result[3]
                else:
                    service_data["rt_backend_location_path"] = None
                    service_data["rt_backend_proxy_pass"] = None
                    service_data["rt_backend_proxy_params"] = None
                    service_data["rt_backend_custom_params"] = None
                
                services_list.append(service_data)
            
            resp = Response({"message": "success", "content": services_list})
            return resp
            
        
        finally:
            cur.close()
            conn.close()

        
    def post(self,request:Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            return Response({"detail": e.detail}, status=e.status_code)
        
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        user_id = request.user.id
        print(request.data)

        srv_name = request.data.get('srv_name')
        srv_ip = request.data.get('srv_ip')
        srv_desc = request.data.get('srv_desc')
        rt_location_path = request.data.get('rt_location_path', '')
        rt_proxy_pass = request.data.get('rt_proxy_pass', '')
        rt_proxy_params = request.data.get('rt_proxy_params', '')
        rt_custom_params = request.data.get('rt_custom_params', '')
        api_rt_location_path = request.data.get('api_rt_location_path', '')
        api_rt_proxy_pass = request.data.get('api_rt_proxy_pass', '')
        api_rt_proxy_params = request.data.get('api_rt_proxy_params', '')
        api_rt_custom_params = request.data.get('api_rt_custom_params', '')
        srv_image_file = request.FILES.get('srv_image')


        uploaded_file = srv_image_file
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
        file_extension = os.path.splitext(uploaded_file.name.lower())
        if file_extension[1] not in allowed_extensions:
            raise ValidationError({"detail": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"})

        file_bytes = uploaded_file.read()
        try:
            cur.execute(
                "insert into services_info (srv_image, srv_name, srv_ip, srv_desc, rt_location_path, rt_proxy_pass, rt_proxy_params, rt_custom_params) values(%s,%s,%s,%s,%s,%s,%s,%s) returning srv_id",
                (
                    psycopg2.Binary(file_bytes),
                    srv_name,
                    srv_ip,
                    srv_desc,
                    rt_location_path,
                    rt_proxy_pass,
                    rt_proxy_params,
                    rt_custom_params,
                ),
            )
            result = cur.fetchone()
            _service_id = result[0]
            
            # Insert API config for this service
            cur.execute(
                "INSERT INTO services_api_info (srv_id, rt_location_path, rt_proxy_pass, rt_proxy_params, rt_custom_params) VALUES (%s, %s, %s, %s, %s)",
                (
                    _service_id,
                    api_rt_location_path,
                    api_rt_proxy_pass,
                    api_rt_proxy_params,
                    api_rt_custom_params,
                ),
            )
            
            cur.execute("SELECT usr_access FROM usr_info WHERE usr_id = %s", (user_id,))
            _result_user_access = cur.fetchone()[0]
            
            if not _result_user_access:
                return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

            allowed_services = _result_user_access.split(",")
            if _service_id not in allowed_services:
                _result_user_access = f"{_result_user_access},{result[0]}"
                cur.execute("update usr_info set usr_access = %s WHERE usr_id = %s", (_result_user_access,user_id,))
            conn.commit()
        
        except psycopg2.Error as e:
            conn.rollback()
            print(e)
            raise APIException(f"Insert failed. {e}")
        except Exception as e:
            print(e)
        finally:
            cur.close()
            conn.close()

        return Response({"message":"Success","id":result[0]})
    
    
    
class ServicesManagerUpdate(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def put(self, request: Request, service_id: int):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        srv_name = request.data.get('srv_name')
        srv_ip = request.data.get('srv_ip')
        srv_desc = request.data.get('srv_desc')
        rt_location_path = request.data.get('rt_location_path')
        rt_proxy_pass = request.data.get('rt_proxy_pass')
        rt_proxy_params = request.data.get('rt_proxy_params')
        rt_custom_params = request.data.get('rt_custom_params')
        api_rt_location_path = request.data.get('api_rt_location_path')
        api_rt_proxy_pass = request.data.get('api_rt_proxy_pass')
        api_rt_proxy_params = request.data.get('api_rt_proxy_params')
        api_rt_custom_params = request.data.get('api_rt_custom_params')
        srv_image_file = request.FILES.get('srv_image')

        query = "UPDATE services_info SET "
        fields = []
        values = []

        if srv_image_file:
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
            file_extension = os.path.splitext(srv_image_file.name.lower())[1]
            if file_extension not in allowed_extensions:
                conn.rollback()
                cur.close()
                conn.close()
                raise ValidationError({"detail": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"})

            file_bytes = srv_image_file.read()
            fields.append("srv_image = %s")
            values.append(psycopg2.Binary(file_bytes))

        if srv_name:
            fields.append("srv_name = %s")
            values.append(srv_name)

        if srv_ip:
            fields.append("srv_ip = %s")
            values.append(srv_ip)

        if srv_desc:
            fields.append("srv_desc = %s")
            values.append(srv_desc)

        if rt_location_path is not None:
            fields.append("rt_location_path = %s")
            values.append(rt_location_path)

        if rt_proxy_pass is not None:
            fields.append("rt_proxy_pass = %s")
            values.append(rt_proxy_pass)

        if rt_proxy_params is not None:
            fields.append("rt_proxy_params = %s")
            values.append(rt_proxy_params)

        if rt_custom_params is not None:
            fields.append("rt_custom_params = %s")
            values.append(rt_custom_params)

        try:
            # Update services_info if there are fields to update
            if fields:
                query += ", ".join(fields) + " WHERE srv_id = %s"
                values.append(service_id)
                cur.execute(query, values)
            
            # Handle API config update - check if row exists
            cur.execute("SELECT api_id FROM services_api_info WHERE srv_id = %s", (service_id,))
            api_row_exists = cur.fetchone()
            
            api_fields = []
            api_values = []
            
            if api_rt_location_path is not None:
                api_fields.append("rt_location_path = %s")
                api_values.append(api_rt_location_path)
            
            if api_rt_proxy_pass is not None:
                api_fields.append("rt_proxy_pass = %s")
                api_values.append(api_rt_proxy_pass)
            
            if api_rt_proxy_params is not None:
                api_fields.append("rt_proxy_params = %s")
                api_values.append(api_rt_proxy_params)
            
            if api_rt_custom_params is not None:
                api_fields.append("rt_custom_params = %s")
                api_values.append(api_rt_custom_params)
            
            if api_fields:
                if api_row_exists:
                    # Update existing API config
                    api_query = "UPDATE services_api_info SET " + ", ".join(api_fields) + " WHERE srv_id = %s"
                    api_values.append(service_id)
                    cur.execute(api_query, api_values)
                else:
                    # Insert new API config if it doesn't exist
                    cur.execute(
                        "INSERT INTO services_api_info (srv_id, rt_location_path, rt_proxy_pass, rt_proxy_params, rt_custom_params) VALUES (%s, %s, %s, %s, %s)",
                        (
                            service_id,
                            api_rt_location_path or '',
                            api_rt_proxy_pass or '',
                            api_rt_proxy_params or '',
                            api_rt_custom_params or '',
                        ),
                    )
            
            conn.commit()

        except psycopg2.Error as e:
            conn.rollback()
            raise APIException(f"Update failed: {e}")
        finally:
            cur.close()
            conn.close()

        return Response({"message": "Success", "id": service_id})
    
    
    def delete(self, request: Request, service_id: int):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        try:
            # Check if service exists
            cur.execute("SELECT 1 FROM services_info WHERE srv_id = %s", (service_id,))
            if cur.fetchone() is None:
                cur.close()
                conn.close()
                return Response({"detail": "Service not found."}, status=status.HTTP_404_NOT_FOUND)

            # Delete API config first (foreign key)
            cur.execute("DELETE FROM services_api_info WHERE srv_id = %s", (service_id,))
            
            # Then delete the service
            cur.execute("DELETE FROM services_info WHERE srv_id = %s", (service_id,))
            conn.commit()

        except psycopg2.Error as e:
            conn.rollback()
            raise APIException(f"Delete failed: {e}")
        finally:
            cur.close()
            conn.close()

        return Response({"message": "Service deleted successfully", "id": service_id}, status=status.HTTP_200_OK)

class NginxConfigGenerator(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()

        try:
            # Fetch all services with their location paths (frontend configs)
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
                    api.rt_custom_params as api_rt_custom_params
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
            
            # Build services data structure
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
                }
                for row in result
            ]
            
            # Optional: Get header and footer from request or use defaults
            header = request.query_params.get('header', HEADER_DEFAULT)
            footer = request.query_params.get('footer', FOOTER_DEFAULT)
            
            # Build nginx config
            nginx_config = NginxConfigBuilder.build_nginx_config(
                services_data=services_data,
                header=header,
                footer=footer,
            )
            
            return Response({
                "message": "Nginx configuration generated successfully",
                "config": nginx_config,
                "services_count": len(services_data),
            }, status=status.HTTP_200_OK, content_type='application/json')  # Return the raw config for display

        except psycopg2.Error as e:
            raise APIException(f"Query execution failed: {e}")
        finally:
            cur.close()
            conn.close()
