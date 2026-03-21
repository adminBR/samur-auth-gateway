from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError,APIException,AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.authentication import get_authorization_header
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from datetime import datetime,timedelta,timezone
import jwt
import psycopg2
import re
import logging

from .serializers import SumInputSerializer
from utils.jwt import create_token,decode_token,get_admin_user_from_token
from utils.database import get_db_connection

logger = logging.getLogger(__name__)

PASSWORD_REGEX = re.compile(r'^(?=.*[A-Za-z])(?=.*\d).+$')  # At least one letter and one number
MIN_PASSWORD_LENGTH = 6
JWT_DEFAULT_EXPIRATION = 1

def validate_password(password):
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError({"detail":f"Senha precisa ter no minimo {MIN_PASSWORD_LENGTH} digitos."})
    
    if not PASSWORD_REGEX.match(password):
        raise ValidationError({"detail": "Senha precisa ter no minimo uma letra e um número."})
    
    return True


class UserRegister(APIView):
    def post(self, request):
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        if not request.data.get('user_name'):
            logger.warning("User registration attempted without 'user_name' field")
            raise ValidationError({"detail":"Missing 'user_name' field."})
        if not request.data.get('user_pass'):
            logger.warning("User registration attempted without 'user_pass' field")
            raise ValidationError({"detail":"Missing 'user_pass' field."})
        else:
            validate_password(request.data.get('user_pass'))

        user_name = request.data.get('user_name')
        user_name = user_name.lower()
        user_pass = request.data.get('user_pass')
        jwt_expiration = request.data.get('jwt_expiration')

        logger.info(f"User registration attempt for username: {user_name}")

        # --- credentials validation ---
        try:
            cur.execute("""SELECT usr_id FROM usr_info WHERE usr_login = %s""", (user_name,))
            if cur.fetchone():
                logger.warning(f"User registration failed: Username '{user_name}' already in use")
                raise ValidationError({"detail":f"Username {user_name} already in use."})

            # --- user creation ---
            cur.execute("""
                INSERT INTO usr_info (usr_login, usr_password, usr_access, usr_admin, created_at, jwt_expiration) 
                VALUES (%s, %s, %s, %s, %s,%s)
            """, (user_name, user_pass, "0", False, datetime.now(tz=timezone.utc),jwt_expiration))

            conn.commit()
            logger.info(f"User registered successfully: {user_name}")
        except psycopg2.Error as e:
            logger.error(f"Database error during user registration for {user_name}: {str(e)}", exc_info=True)
            raise APIException({"detail":'Database query error!'})
        finally:
            cur.close()
            conn.close()
            
        return Response({'response': f"User: {user_name} has been successfully registered"})
        

@method_decorator(csrf_exempt, name='dispatch')
class UserLogin(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        conn = get_db_connection()
        cur = conn.cursor()

        if not request.data.get('user_name'):
            logger.warning("Login attempt without 'user_name' field")
            raise ValidationError({"detail":"Missing 'user_name' field."})
        if not request.data.get('user_pass'):
            logger.warning("Login attempt without 'user_pass' field")
            raise ValidationError({"detail":"Missing 'user_pass' field."})
        else:
            validate_password(request.data.get('user_pass'))

        user_name = request.data.get('user_name')
        user_name = user_name.lower()
        user_pass = request.data.get('user_pass')

        logger.info(f"Login attempt for username: {user_name}")

        try:
            cur.execute("""
                SELECT usr_id, usr_admin, jwt_expiration FROM usr_info 
                WHERE usr_login = %s AND usr_password = %s
            """, (user_name, user_pass,))
            user = cur.fetchone()
            
        except psycopg2.Error as e:
            logger.error(f"Database error during login for {user_name}: {str(e)}", exc_info=True)
            raise APIException({"detail":'Database query error!'})
        finally:
            cur.close()
            conn.close()

        if not user:
            logger.warning(f"Login failed for username: {user_name} - Invalid credentials")
            raise ValidationError({"detail":"User not found or invalid credentials."})

        access_token = create_token(user[0], user_name, "inf" if user[2]=="inf" else int(user[2]))
        refresh_token = create_token(user[0], user_name, 90)

        logger.info(f"User logged in successfully: {user_name} (ID: {user[0]})")

        resp = Response({
            "response": "Login successful",
            "user": {"id": user[0], "username": user_name},
            "access_token": access_token,
            "refresh_token": refresh_token,
            "isAdmin":user[1],
            "jwt_expiration":user[2]
        })
        resp.set_cookie(
            key="token",
            value=access_token,
            httponly=True,
            secure=False,
            domain="indicadores.samur.br",
            samesite="Lax",
            path="/",
            max_age=60 * 60 * 24 * 365 * 20 if user[2]=="inf" else 60 * 60 * 24 * 1
        ) # Cookie will last for 20 years if its infinite or the 1 day for finite
        return resp
        

    
class UserLogout(APIView):
    def get(self,request):
        logger.info(f"User logout for user_id: {request.user.id if hasattr(request, 'user') else 'Unknown'}")
        response = Response({'message': 'Logged out'})
        response.delete_cookie('token')  # This must match the cookie name you set
        return response

        
class ValidateToken(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        auth = get_authorization_header(request).decode()
        service_id = request.headers.get("X-Service-ID")
        token = request.COOKIES.get('token')
        logger.debug(f"Token validation attempt - Service ID: {service_id}, Token present: {bool(token) or bool(auth)}")
        if not token:
            if auth:
                token = auth.split(' ')[1]
            else:
                logger.warning("Token validation failed: No token provided")
                return Response({"detail": "No token provided"}, 
                            status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = decode_token(token)
            logger.debug(f"Token decoded successfully for user_id: {payload.get('user_id')}")
            if(payload["expiration"] != "inf"):
                expiration = datetime.fromisoformat(payload["expiration"])
                if expiration < datetime.now(timezone.utc):
                    logger.warning(f"Token validation failed: Token expired for user_id: {payload.get('user_id')}")
                    return Response({"detail":"Token expired"},status=status.HTTP_401_UNAUTHORIZED)
                
            user_id = payload["user_id"]

            if service_id:
                conn = get_db_connection()
                cur = conn.cursor()
                try:
                    cur.execute("SELECT usr_access FROM usr_info WHERE usr_id = %s", (user_id,))
                    result = cur.fetchone()
                    if not result:
                        logger.warning(f"Token validation failed: User not found - user_id: {user_id}")
                        return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

                    allowed_services = result[0].split(",")
                    if service_id not in allowed_services:
                        logger.warning(f"Token validation failed: Access denied - user_id: {user_id}, service_id: {service_id}")
                        return Response({"detail": "Access denied to this service"},
                                        status=status.HTTP_401_UNAUTHORIZED)
                    logger.debug(f"Token validation successful for user_id: {user_id}, service_id: {service_id}")
                except psycopg2.Error as e:
                    logger.error(f"Database error during token validation: {str(e)}", exc_info=True)
                    raise APIException({"detail":'Database query error!'})
                finally:
                    cur.close()
                    conn.close()

            logger.info(f"Token validated successfully for user_id: {user_id}")
            return Response({"user_id": payload["user_id"],
                             "user_name": payload["user_name"]},
                            status=status.HTTP_200_OK)
        except jwt.ExpiredSignatureError:
            logger.warning("Token validation failed: Token signature expired")
            return Response({"detail":"Token expired"},
                            status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            logger.warning("Token validation failed: Invalid token")
            return Response({"detail":"Invalid token"},
                            status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {str(e)}", exc_info=True)
            return Response({"detail": str(e)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class RefreshToken(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            logger.warning("Token refresh attempted without refresh_token")
            return Response({"detail": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

        logger.debug("Attempting to refresh token")
        try:
            payload = decode_token(refresh_token)
            
            if(payload["expiration"] != "inf"):
                expiration = datetime.fromisoformat(payload["expiration"])
                if expiration < datetime.now(timezone.utc):
                    logger.warning(f"Token refresh failed: Refresh token expired for user_id: {payload.get('user_id')}")
                    return Response({"detail": "Refresh token expired"}, status=status.HTTP_401_UNAUTHORIZED)

            # Issue a new access token
            new_access_token = create_token(payload["user_id"],payload["user_name"],payload["expiration"])

            logger.info(f"Token refreshed successfully for user_id: {payload.get('user_id')}")
            return Response({
                "access_token": f"Bearer {new_access_token}"
            }, status=status.HTTP_200_OK)

        except jwt.ExpiredSignatureError:
            logger.warning("Token refresh failed: Token expired")
            return Response({"detail": "Token expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            logger.warning("Token refresh failed: Invalid token")
            return Response({"detail": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {str(e)}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminAllUsersOperations(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        admin_user = get_admin_user_from_token(request)
        logger.info(f"Admin user {admin_user['user_id']} fetching all users")
        
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT usr_id, usr_login, usr_admin, usr_access, created_at, jwt_expiration FROM usr_info ORDER BY usr_id")
            users_data = cur.fetchall()
            users_list = [
                {
                    "id": row[0], 
                    "username": row[1], 
                    "is_admin": row[2], 
                    "access": row[3],
                    "created_at": row[4].isoformat() if row[4] else None,
                    "jwt_expiration": row[5]
                } for row in users_data
            ]
            logger.debug(f"Retrieved {len(users_list)} users from database")
        except psycopg2.Error as e:
            logger.error(f"Database error while fetching all users: {str(e)}", exc_info=True)
            raise APIException({"detail":f"Database query error: {e}"})
        finally:
            cur.close()
            conn.close()
            
        return Response(users_list, status=status.HTTP_200_OK)

    def post(self, request):
        admin_user = get_admin_user_from_token(request)

        data = request.data
        user_name = data.get('user_name')
        user_pass = data.get('user_pass')
        is_admin = data.get('is_admin', False)
        usr_access = data.get('access', "")
        jwt_expiration = data.get('jwt_expiration')

        if not user_name:
            logger.warning(f"Admin {admin_user['user_id']} attempted to create user without user_name")
            raise ValidationError({"detail":"Missing 'user_name' field."})
        if not user_pass:
            logger.warning(f"Admin {admin_user['user_id']} attempted to create user without user_pass")
            raise ValidationError({"detail":"Missing 'user_pass' field."})
        
        validate_password(user_pass)

        user_name = user_name.lower()
        user_pass_processed = user_pass

        logger.info(f"Admin {admin_user['user_id']} creating new user: {user_name}")

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute("SELECT usr_id FROM usr_info WHERE usr_login = %s", (user_name,))
            if cur.fetchone():
                logger.warning(f"User creation failed by admin {admin_user['user_id']}: Username '{user_name}' already in use")
                raise ValidationError({"detail":f"Username '{user_name}' already in use."})

            cur.execute("""
                INSERT INTO usr_info (usr_login, usr_password, usr_admin, usr_access, created_at, jwt_expiration)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING usr_id
            """, (user_name, user_pass_processed, bool(is_admin), usr_access, datetime.now(tz=timezone.utc),jwt_expiration))
            response = cur.fetchone()
            
            if(response and response[0]):
                new_user_id = response[0]
            else:
                logger.error(f"Error inserting user '{user_name}' by admin {admin_user['user_id']}: No return value")
                raise APIException({"detail":f"Error inserting values..."})
            
            conn.commit()
            logger.info(f"User '{user_name}' created successfully by admin {admin_user['user_id']} with ID: {new_user_id}")
            
        except psycopg2.Error as db_error:
            conn.rollback()
            logger.error(f"Database error creating user '{user_name}' by admin {admin_user['user_id']}: {str(db_error)}", exc_info=True)
            if "unique constraint" in str(db_error).lower() and "usr_login" in str(db_error).lower():
                 raise ValidationError({"detail":f"Username '{user_name}' already in use."})
            raise APIException({"detail":f"Database error: {db_error}"})
        finally:
            cur.close()
            conn.close()
            
        return Response({
                "response": f"User '{user_name}' created successfully.",
                "user": {"id": new_user_id, "username": user_name, "is_admin": bool(is_admin), "access": usr_access, "jwt_expiration":jwt_expiration}
            }, status=status.HTTP_201_CREATED)


class AdminSingleUserOperations(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, target_user_id):
        admin_user = get_admin_user_from_token(request)
        logger.info(f"Admin {admin_user['user_id']} fetching user details for user_id: {target_user_id}")

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT usr_id, usr_login, usr_admin, usr_access, created_at, jwt_expiration FROM usr_info WHERE usr_id = %s", (target_user_id,))
            user_data = cur.fetchone()
            if not user_data:
                logger.warning(f"User not found - user_id: {target_user_id}")
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            user_details = {
                "id": user_data[0], 
                "username": user_data[1], 
                "is_admin": user_data[2], 
                "access": user_data[3],
                "created_at": user_data[4].isoformat() if user_data[4] else None,
                "jwt_expiration": user_data[5]
            }
            return Response(user_details, status=status.HTTP_200_OK)
        except psycopg2.Error as e:
            logger.error(f"Database error fetching user {target_user_id}: {str(e)}", exc_info=True)
            raise APIException({"detail":f"Database query error: {e}"})
        finally:
            cur.close()
            conn.close()

    def put(self, request, target_user_id):
        admin_user = get_admin_user_from_token(request)
        logger.info(f"Admin {admin_user['user_id']} updating user_id: {target_user_id}")

        data = request.data
        user_pass = data.get('user_pass')
        is_admin = data.get('is_admin',False)
        usr_access = data.get('access')
        jwt_expiration = data.get('jwt_expiration')

        update_fields = []
        update_values = []

        if user_pass is not None:
            if user_pass == "":
                 logger.warning(f"User update failed: Empty password provided for user_id: {target_user_id}")
                 raise ValidationError({"detail":"Password cannot be empty if provided for update."})
            validate_password(user_pass)
            
            update_fields.append("usr_password = %s")
            update_values.append(user_pass)

        if is_admin is not None:
            # Prevent admin from de-admining themselves if they are the one making the request
            # This is a basic safety, more complex logic might be needed (e.g., last admin check)
            if int(admin_user["user_id"]) == int(target_user_id) and not bool(is_admin):
                 logger.warning(f"Admin {admin_user['user_id']} attempted to remove their own admin privileges")
                 return Response({"detail": "Admin cannot remove their own admin privileges through this endpoint."}, status=status.HTTP_400_BAD_REQUEST)
            update_fields.append("usr_admin = %s")
            update_values.append(bool(is_admin))

        if usr_access is not None:
            update_fields.append("usr_access = %s")
            update_values.append(usr_access)
            
        if jwt_expiration is not None:
            update_fields.append("jwt_expiration = %s")
            update_values.append(jwt_expiration)
        
        if not update_fields:
            logger.warning(f"User update attempted with no data provided for user_id: {target_user_id}")
            return Response({"detail": "No update data provided."}, status=status.HTTP_400_BAD_REQUEST)

        update_values.append(target_user_id) # For the WHERE clause

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            # Check if user exists before updating
            cur.execute("SELECT usr_id FROM usr_info WHERE usr_id = %s", (target_user_id,))
            if not cur.fetchone():
                logger.warning(f"User not found for update - user_id: {target_user_id}")
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

            query = f"UPDATE usr_info SET {', '.join(update_fields)} WHERE usr_id = %s"
            cur.execute(query, tuple(update_values))
            conn.commit()

            # Fetch updated user details to return
            cur.execute("SELECT usr_id, usr_login, usr_admin, usr_access, jwt_expiration FROM usr_info WHERE usr_id = %s", (target_user_id,))
            updated_user = cur.fetchone()
            
        except psycopg2.Error as db_error:
            conn.rollback()
            logger.error(f"Database error updating user {target_user_id}: {str(db_error)}", exc_info=True)
            raise APIException({"detail":f"Database error: {db_error}"})
        finally:
            cur.close()
            conn.close()
        
        if(not updated_user):
            logger.error(f"No data returned after updating user_id: {target_user_id}")
            raise APIException({"detail":"No return from database..."})
        
        logger.info(f"User {target_user_id} updated successfully by admin {admin_user['user_id']}")
        return Response({
            "response": f"User ID {target_user_id} updated successfully.",
            "user": {
                "id": updated_user[0],
                "username": updated_user[1],
                "is_admin": updated_user[2],
                "access": updated_user[3],
                "jwt_expiration": updated_user[4]
            }
        }, status=status.HTTP_200_OK)

    def delete(self, request, target_user_id):
        admin_user = get_admin_user_from_token(request)
        
        # Basic check to prevent admin from deleting themselves
        if int(admin_user["user_id"]) == int(target_user_id):
            logger.warning(f"Admin {admin_user['user_id']} attempted to delete themselves")
            return Response({"detail": "Admin cannot delete themselves through this interface."}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Admin {admin_user['user_id']} deleting user_id: {target_user_id}")

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute("SELECT usr_id FROM usr_info WHERE usr_id = %s", (target_user_id,))
            if not cur.fetchone():
                logger.warning(f"User not found for deletion - user_id: {target_user_id}")
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            cur.execute("DELETE FROM usr_info WHERE usr_id = %s", (target_user_id,))
            if cur.rowcount == 0:
                logger.warning(f"Delete operation affected no rows - user_id: {target_user_id}")
                return Response({"detail": "User not found or already deleted."}, status=status.HTTP_404_NOT_FOUND)
            conn.commit()
            logger.info(f"User {target_user_id} deleted successfully by admin {admin_user['user_id']}")
        except psycopg2.Error as db_error:
            conn.rollback()
            logger.error(f"Database error deleting user {target_user_id}: {str(db_error)}", exc_info=True)
            raise APIException({"detail":f"Database error: {db_error}"})
        finally:
            cur.close()
            conn.close()
        
        return Response({"response": f"User ID {target_user_id} deleted successfully."}, status=status.HTTP_200_OK)
            
class AdminListAllServicesView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        admin_user = get_admin_user_from_token(request)
        logger.info(f"Admin {admin_user['user_id']} fetching all services")

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT srv_id, srv_name, srv_desc, srv_category FROM services_info ORDER BY srv_name")
            services_data = cur.fetchall()
            logger.debug(f"Retrieved {len(services_data)} services from database")
        except psycopg2.Error as e:
            logger.error(f"Database error while fetching all services: {str(e)}", exc_info=True)
            raise APIException({"detail":f"Database query error while fetching all services: {e}"})
        finally:
            cur.close()
            conn.close()
            
        services_list = [
                {
                    "srv_id": row[0], 
                    "srv_name": row[1], 
                    "srv_desc": row[2],
                    "srv_category": row[3],
                } for row in services_data
            ]
        
        return Response(services_list, status=status.HTTP_200_OK)


class UserMe(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = request.COOKIES.get('token')
        auth = get_authorization_header(request).decode()

        if not token:
            if auth and auth.startswith('Bearer '):
                token = auth.split(' ')[1]
            else:
                logger.warning("UserMe: No token provided")
                return Response({"detail": "No token provided"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = decode_token(token)
            if payload["expiration"] != "inf":
                expiration = datetime.fromisoformat(payload["expiration"])
                if expiration < datetime.now(timezone.utc):
                    return Response({"detail": "Token expired"}, status=status.HTTP_401_UNAUTHORIZED)

            user_id = payload["user_id"]
            conn = get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("SELECT usr_admin FROM usr_info WHERE usr_id = %s", (user_id,))
                row = cur.fetchone()
                if not row:
                    return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
                is_admin = row[0]
            except psycopg2.Error as e:
                logger.error(f"Database error in UserMe: {str(e)}", exc_info=True)
                raise APIException({"detail": "Database query error!"})
            finally:
                cur.close()
                conn.close()

            logger.info(f"UserMe: returned data for user_id {user_id}")
            return Response({
                "user_id": payload["user_id"],
                "user_name": payload["user_name"],
                "is_admin": is_admin
            }, status=status.HTTP_200_OK)

        except jwt.ExpiredSignatureError:
            return Response({"detail": "Token expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            return Response({"detail": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error in UserMe: {str(e)}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
