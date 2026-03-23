import base64
import logging
import os

import psycopg2
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.database import get_db_connection
from utils.jwt import get_admin_user_from_token

logger = logging.getLogger(__name__)


def fetch_service_categories(cur) -> list[dict[str, int | str]]:
    cur.execute(
        "SELECT tag_id, tag_name FROM services_category ORDER BY tag_id"
    )
    rows = cur.fetchall()
    return [{"tag_id": row[0], "tag_name": row[1]} for row in rows]


def get_service_category_lookup(cur):
    categories = fetch_service_categories(cur)
    if not categories:
        raise APIException({"detail": "No service categories configured."})

    categories_by_id = {int(category["tag_id"]): category for category in categories}
    categories_by_name = {
        str(category["tag_name"]).strip().lower(): category
        for category in categories
        if category["tag_name"]
    }
    default_category_id = int(categories[0]["tag_id"])

    return categories, categories_by_id, categories_by_name, default_category_id


def build_service_category_error(
    categories: list[dict[str, int | str]],
) -> dict[str, str]:
    allowed_values = ", ".join(
        f'{category["tag_id"]} ({category["tag_name"]})' for category in categories
    )
    return {
        "detail": (
            "Categoria invalida. Informe um ID existente de services_category. "
            f"Valores permitidos: {allowed_values}."
        )
    }


def normalize_service_category(
    category: str | int | None,
    categories: list[dict[str, int | str]],
    categories_by_id: dict[int, dict[str, int | str]],
    categories_by_name: dict[str, dict[str, int | str]],
    default_category_id: int,
    *,
    fallback_to_default: bool = False,
) -> int:
    if category is None:
        return default_category_id

    category_text = str(category).strip()
    if category_text == "":
        return default_category_id

    if isinstance(category, int):
        category_id = category
    elif category_text.isdigit():
        category_id = int(category_text)
    else:
        matched_category = categories_by_name.get(category_text.lower())
        if matched_category is not None:
            return int(matched_category["tag_id"])

        if fallback_to_default:
            logger.warning(
                "Unknown legacy service category '%s'. Falling back to category_id=%s.",
                category,
                default_category_id,
            )
            return default_category_id

        raise ValidationError(build_service_category_error(categories))

    if category_id in categories_by_id:
        return category_id

    if fallback_to_default:
        logger.warning(
            "Unknown service category id '%s'. Falling back to category_id=%s.",
            category,
            default_category_id,
        )
        return default_category_id

    raise ValidationError(build_service_category_error(categories))


class ServiceCategoriesManager(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            categories = fetch_service_categories(cur)
            logger.info("Successfully retrieved %s service categories", len(categories))
            return Response({"message": "success", "content": categories})
        except Exception as e:
            logger.error(
                "Error fetching service categories: %s",
                str(e),
                exc_info=True,
            )
            raise
        finally:
            cur.close()
            conn.close()


class ServicesManager(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request):
        
        user_id = request.user.id
        conn = get_db_connection()
        cur = conn.cursor()
        logger.info(f"Fetching services for user_id: {user_id}")
        try:
            categories, categories_by_id, categories_by_name, default_category_id = (
                get_service_category_lookup(cur)
            )

            cur.execute(
                "SELECT usr_access FROM usr_info ui WHERE ui.usr_id = %s",
                (user_id,),
            )
            result = cur.fetchone()
            user_services = [
                int(service_id.strip())
                for service_id in str(result[0] or "").split(",")
                if service_id.strip().isdigit()
            ]

            if not user_services:
                logger.info("No services configured for user_id: %s", user_id)
                return Response({"message": "success", "content": []})

            cur.execute(
                """
                SELECT
                    srv_id,
                    srv_image,
                    srv_name,
                    srv_ip,
                    srv_desc,
                    srv_category,
                    rt_frontend_block,
                    rt_backend_block,
                    rt_enabled
                FROM services_info si
                WHERE si.srv_id = ANY(%s)
                ORDER BY si.srv_id
                """,
                (user_services,),
            )
            result = cur.fetchall()
            services_list = []
            for row in result:
                service_data = {
                    "srv_id": row[0],
                    "srv_image": base64.b64encode(row[1]).decode('utf-8') if row[1] else None,
                    "srv_name": row[2],
                    "srv_ip": row[3],
                    "srv_desc": row[4],
                    "srv_category": normalize_service_category(
                        row[5],
                        categories,
                        categories_by_id,
                        categories_by_name,
                        default_category_id,
                        fallback_to_default=True,
                    ),
                    "rt_frontend_block": row[6],
                    "rt_backend_block": row[7],
                    "rt_enabled": row[8],
                }
                
                services_list.append(service_data)
            
            logger.info(f"Successfully retrieved {len(services_list)} services for user_id: {user_id}")
            resp = Response({"message": "success", "content": services_list})
            return resp
            
        except Exception as e:
            logger.error(f"Error fetching services for user_id {user_id}: {str(e)}", exc_info=True)
            raise
        finally:
            cur.close()
            conn.close()

        
    def post(self,request:Request):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            logger.warning(f"Admin authentication failed: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)
        
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        user_id = request.user.id
        logger.debug(f"Creating new service with request data: {request.data}")

        srv_name = request.data.get('srv_name')
        srv_ip = request.data.get('srv_ip')
        srv_desc = request.data.get('srv_desc')
        rt_frontend_block = request.data.get('rt_frontend_block', '')
        rt_backend_block = request.data.get('rt_backend_block', '')
        rt_enabled = request.data.get('rt_enabled', True)
        srv_image_file = request.FILES.get('srv_image')

        categories, categories_by_id, categories_by_name, default_category_id = (
            get_service_category_lookup(cur)
        )
        srv_category = normalize_service_category(
            request.data.get('srv_category'),
            categories,
            categories_by_id,
            categories_by_name,
            default_category_id,
        )

        uploaded_file = srv_image_file
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
        file_extension = os.path.splitext(uploaded_file.name.lower())
        if file_extension[1] not in allowed_extensions:
            logger.warning(f"Invalid file extension '{file_extension[1]}' for service image upload")
            raise ValidationError({"detail": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"})

        file_bytes = uploaded_file.read()
        try:
            cur.execute(
                "insert into services_info (srv_image, srv_name, srv_ip, srv_desc, srv_category, rt_frontend_block, rt_backend_block, rt_enabled) values(%s,%s,%s,%s,%s,%s,%s,%s) returning srv_id",
                (
                    psycopg2.Binary(file_bytes),
                    srv_name,
                    srv_ip,
                    srv_desc,
                    srv_category,
                    rt_frontend_block,
                    rt_backend_block,
                    rt_enabled,
                ),
            )
            result = cur.fetchone()
            _service_id = result[0]
            
            cur.execute("SELECT usr_access FROM usr_info WHERE usr_id = %s", (user_id,))
            _result_user_access = cur.fetchone()[0]
            
            if not _result_user_access:
                return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

            allowed_services = _result_user_access.split(",")
            if str(_service_id) not in allowed_services:
                _result_user_access = f"{_result_user_access},{_service_id}"
                cur.execute("update usr_info set usr_access = %s WHERE usr_id = %s", (_result_user_access,user_id,))
            conn.commit()
            logger.info(f"Service created successfully with srv_id: {_service_id} by user_id: {user_id}")
        
        except psycopg2.Error as e:
            conn.rollback()
            logger.error(f"Database error while creating service: {str(e)}", exc_info=True)
            raise APIException(f"Insert failed. {e}")
        except Exception as e:
            logger.error(f"Unexpected error while creating service: {str(e)}", exc_info=True)
            raise
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
            logger.warning(f"Admin authentication failed for service update: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        logger.debug(f"Updating service_id: {service_id} with request data: {request.data}")

        srv_name = request.data.get('srv_name')
        srv_ip = request.data.get('srv_ip')
        srv_desc = request.data.get('srv_desc')
        srv_category = request.data.get('srv_category')
        rt_frontend_block = request.data.get('rt_frontend_block')
        rt_backend_block = request.data.get('rt_backend_block')
        rt_enabled = request.data.get('rt_enabled')
        srv_image_file = request.FILES.get('srv_image')

        categories = []
        categories_by_id = {}
        categories_by_name = {}
        default_category_id = 0
        if srv_category is not None:
            categories, categories_by_id, categories_by_name, default_category_id = (
                get_service_category_lookup(cur)
            )

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

        if srv_name is not None:
            fields.append("srv_name = %s")
            values.append(srv_name)

        if srv_ip is not None:
            fields.append("srv_ip = %s")
            values.append(srv_ip)

        if srv_desc is not None:
            fields.append("srv_desc = %s")
            values.append(srv_desc)

        if srv_category is not None:
            fields.append("srv_category = %s")
            values.append(
                normalize_service_category(
                    srv_category,
                    categories,
                    categories_by_id,
                    categories_by_name,
                    default_category_id,
                )
            )

        if rt_frontend_block is not None:
            fields.append("rt_frontend_block = %s")
            values.append(rt_frontend_block)

        if rt_backend_block is not None:
            fields.append("rt_backend_block = %s")
            values.append(rt_backend_block)

        if rt_enabled is not None:
            fields.append("rt_enabled = %s")
            values.append(rt_enabled)

        try:
            if fields:
                query += ", ".join(fields) + " WHERE srv_id = %s"
                values.append(service_id)
                cur.execute(query, values)
            
            conn.commit()
            logger.info(f"Service updated successfully with service_id: {service_id}")

        except psycopg2.Error as e:
            conn.rollback()
            logger.error(f"Database error while updating service_id {service_id}: {str(e)}", exc_info=True)
            raise APIException(f"Update failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while updating service_id {service_id}: {str(e)}", exc_info=True)
            raise
        finally:
            cur.close()
            conn.close()

        return Response({"message": "Success", "id": service_id})
    
    
    def delete(self, request: Request, service_id: int):
        try:
            get_admin_user_from_token(request)
        except APIException as e:
            logger.warning(f"Admin authentication failed for service deletion: {e.detail}")
            return Response({"detail": e.detail}, status=e.status_code)

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        logger.debug(f"Deleting service_id: {service_id}")

        try:
            # Check if service exists
            cur.execute("SELECT 1 FROM services_info WHERE srv_id = %s", (service_id,))
            if cur.fetchone() is None:
                cur.close()
                conn.close()
                return Response({"detail": "Service not found."}, status=status.HTTP_404_NOT_FOUND)

            # Delete the service (no need to delete from services_api_info anymore)
            cur.execute("DELETE FROM services_info WHERE srv_id = %s", (service_id,))
            conn.commit()
            logger.info(f"Service deleted successfully with service_id: {service_id}")

        except psycopg2.Error as e:
            conn.rollback()
            logger.error(f"Database error while deleting service_id {service_id}: {str(e)}", exc_info=True)
            raise APIException(f"Delete failed: {e}")
        finally:
            cur.close()
            conn.close()

        return Response({"message": "Service deleted successfully", "id": service_id}, status=status.HTTP_200_OK)
