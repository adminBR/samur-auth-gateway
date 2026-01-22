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

            cur.execute(f"SELECT * FROM services_info si WHERE si.srv_id IN ({user_services})")
            result = cur.fetchall()
            services_list = [
            {
                "srv_id": row[0],
                "srv_image": base64.b64encode(row[1]).decode('utf-8') if row[1] else None,
                "srv_name": row[2],
                "srv_ip": row[3],
                "srv_desc": row[4],
                "rt_location_path": row[5],
                "rt_proxy_pass": row[6],
                "rt_proxy_params": row[7],
                "rt_custom_params": row[8],
            } for row in result
        ]
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
    parser_classes = [MultiPartParser, FormParser] # Ensure FormParser is included if not always multipart

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
        srv_image_file = request.FILES.get('srv_image')

        query = "UPDATE services_info SET "
        fields = []
        values = []

        if srv_image_file:
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
            file_extension = os.path.splitext(srv_image_file.name.lower())[1]
            if file_extension not in allowed_extensions:
                conn.rollback() # Rollback before raising
                cur.close()
                conn.close()
                raise ValidationError({"detail": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"})

            file_bytes = srv_image_file.read()
            fields.append("srv_image = %s")
            values.append(psycopg2.Binary(file_bytes)) # Store as binary

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

        if not fields:
            cur.close() # Close cursor and connection
            conn.close()
            return Response({"detail": "No fields to update."}, status=status.HTTP_400_BAD_REQUEST)

        query += ", ".join(fields) + " WHERE srv_id = %s"
        values.append(service_id)

        try:
            cur.execute(query, values)
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

            # Proceed to delete
            cur.execute("DELETE FROM services_info WHERE srv_id = %s", (service_id,))
            conn.commit()

        except psycopg2.Error as e:
            conn.rollback()
            raise APIException(f"Delete failed: {e}")
        finally:
            cur.close()
            conn.close()

        return Response({"message": "Service deleted successfully", "id": service_id}, status=status.HTTP_200_OK)
