from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError,APIException,AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from datetime import datetime,timezone
import jwt
import psycopg2
import re
import logging

from utils.jwt import (
    TOKEN_TYPE_ACCESS,
    TOKEN_TYPE_REFRESH,
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    fetch_user_auth_context,
    get_access_token_from_request,
    get_admin_user_from_token,
    get_refresh_token_from_request,
    serialize_access_lifetime,
    set_access_token_cookie,
    set_refresh_token_cookie,
    validate_token_payload,
)
from utils.database import get_db_connection
from users.tasy_auth import (
    TasyAuthConfigurationError,
    TasyAuthError,
    authenticate_tasy_user_with_identity,
    is_tasy_auth_configured,
    normalize_tasy_username,
)

logger = logging.getLogger(__name__)

PASSWORD_REGEX = re.compile(r'^(?=.*[A-Za-z])(?=.*\d).+$')  # At least one letter and one number
MIN_PASSWORD_LENGTH = 6
TASY_PASSWORD_PLACEHOLDER = "TASY"
DEFAULT_TASY_USER_ACCESS = ""


def normalize_jwt_expiration(value):
    try:
        return serialize_access_lifetime(value)
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)}) from exc

def validate_password(password):
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError({"detail":f"Senha precisa ter no minimo {MIN_PASSWORD_LENGTH} digitos."})
    
    if not PASSWORD_REGEX.match(password):
        raise ValidationError({"detail": "Senha precisa ter no minimo uma letra e um número."})
    
    return True


def normalize_case_insensitive_value(value):
    return str(value or "").upper()


def canonicalize_username(username, *, is_tasy=False):
    normalized_username = str(username or "").strip()
    if is_tasy:
        return normalize_tasy_username(normalized_username)
    return normalized_username


def build_user_record(row):
    is_tasy = bool(row[5])
    return {
        "id": row[0],
        "username": canonicalize_username(row[1], is_tasy=is_tasy),
        "password": row[2],
        "is_admin": bool(row[3]),
        "jwt_expiration": row[4],
        "is_tasy": is_tasy,
    }


def fetch_user_record_by_login(cur, user_name):
    cur.execute(
        """
        SELECT
            usr_id,
            usr_login,
            usr_password,
            usr_admin,
            jwt_expiration,
            COALESCE(usr_tasy, FALSE)
        FROM usr_info
        WHERE UPPER(usr_login) = UPPER(%s)
        """,
        (user_name,),
    )
    row = cur.fetchone()
    return build_user_record(row) if row else None


def provision_tasy_user(cur, user_name):
    normalized_username = normalize_tasy_username(user_name)
    jwt_expiration = serialize_access_lifetime(None)
    cur.execute(
        """
        INSERT INTO usr_info (
            usr_login,
            usr_password,
            usr_admin,
            usr_access,
            created_at,
            jwt_expiration,
            usr_tasy
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (usr_login) DO NOTHING
        RETURNING
            usr_id,
            usr_login,
            usr_password,
            usr_admin,
            jwt_expiration,
            usr_tasy
        """,
        (
            normalized_username,
            TASY_PASSWORD_PLACEHOLDER,
            False,
            DEFAULT_TASY_USER_ACCESS,
            datetime.now(tz=timezone.utc),
            jwt_expiration,
            True,
        ),
    )
    row = cur.fetchone()
    if row:
        return build_user_record(row)

    existing_user = fetch_user_record_by_login(cur, user_name)
    if existing_user and existing_user["is_tasy"]:
        return existing_user

    return None


def fetch_existing_tasy_user_record(cur, usernames):
    for username in usernames:
        existing_user = fetch_user_record_by_login(cur, username)
        if existing_user and existing_user["is_tasy"]:
            return existing_user

    return None


def authenticate_user_for_login(cur, user_name, user_pass):
    user = fetch_user_record_by_login(cur, user_name)
    if user and not user["is_tasy"]:
        if normalize_case_insensitive_value(user["password"]) == normalize_case_insensitive_value(user_pass):
            return user, False
        return None, False

    if not user and not is_tasy_auth_configured():
        return None, False

    if user and user["is_tasy"] and not is_tasy_auth_configured():
        raise TasyAuthConfigurationError(
            "Tasy authentication is not configured for this user."
        )

    is_valid_tasy_login, tasy_identity = authenticate_tasy_user_with_identity(
        user_name,
        user_pass,
    )
    if not is_valid_tasy_login:
        return None, False

    if tasy_identity:
        existing_tasy_user = fetch_existing_tasy_user_record(
            cur,
            tasy_identity["lookup_usernames"],
        )
        if existing_tasy_user:
            return existing_tasy_user, False

    if user and user["is_tasy"]:
        return user, False

    provisioned_user = provision_tasy_user(
        cur,
        (tasy_identity or {}).get("canonical_username") or user_name,
    )
    if not provisioned_user:
        raise APIException({"detail": "Failed to provision the Tasy-backed user."})

    return provisioned_user, True


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

        user_name = str(request.data.get('user_name') or "").strip()
        user_pass = request.data.get('user_pass')
        jwt_expiration = normalize_jwt_expiration(request.data.get('jwt_expiration'))

        logger.info(f"User registration attempt for username: {user_name}")

        # --- credentials validation ---
        try:
            cur.execute("""SELECT usr_id FROM usr_info WHERE usr_login = %s""", (user_name,))
            if cur.fetchone():
                logger.warning(f"User registration failed: Username '{user_name}' already in use")
                raise ValidationError({"detail":f"Username {user_name} already in use."})

            # --- user creation ---
            cur.execute("""
                INSERT INTO usr_info (
                    usr_login,
                    usr_password,
                    usr_access,
                    usr_admin,
                    created_at,
                    jwt_expiration,
                    usr_tasy
                ) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_name, user_pass, "0", False, datetime.now(tz=timezone.utc), jwt_expiration, False))

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
        conn.autocommit = False

        if not request.data.get('user_name'):
            logger.warning("Login attempt without 'user_name' field")
            raise ValidationError({"detail":"Missing 'user_name' field."})
        if not request.data.get('user_pass'):
            logger.warning("Login attempt without 'user_pass' field")
            raise ValidationError({"detail":"Missing 'user_pass' field."})

        user_name = str(request.data.get('user_name') or "").strip()
        user_pass = request.data.get('user_pass')

        logger.info(f"Login attempt for username: {user_name}")

        try:
            user, did_create_user = authenticate_user_for_login(cur, user_name, user_pass)
            if did_create_user:
                conn.commit()
                logger.info("Provisioned Tasy-backed shadow user for '%s'", user_name)
        except psycopg2.Error as e:
            conn.rollback()
            logger.error(f"Database error during login for {user_name}: {str(e)}", exc_info=True)
            raise APIException({"detail":'Database query error!'})
        except TasyAuthConfigurationError as e:
            conn.rollback()
            logger.error("Tasy authentication is not configured for '%s': %s", user_name, str(e))
            return Response({"detail": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except TasyAuthError as e:
            conn.rollback()
            logger.error("Tasy authentication failed unexpectedly for '%s': %s", user_name, str(e), exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        finally:
            cur.close()
            conn.close()

        if not user:
            logger.warning(f"Login failed for username: {user_name} - Invalid credentials")
            raise ValidationError({"detail":"User not found or invalid credentials."})

        jwt_expiration = normalize_jwt_expiration(user["jwt_expiration"])
        authenticated_user_name = user["username"]
        access_token = create_access_token(user["id"], authenticated_user_name, jwt_expiration)
        refresh_token = create_refresh_token(user["id"], authenticated_user_name)

        logger.info(
            "User logged in successfully: %s (ID: %s, Tasy: %s)",
            authenticated_user_name,
            user["id"],
            user["is_tasy"],
        )

        resp = Response({
            "response": "Login successful",
            "user": {"id": user["id"], "username": authenticated_user_name},
            "access_token": access_token,
            "refresh_token": refresh_token,
            "isAdmin":user["is_admin"],
            "isTasy": user["is_tasy"],
            "jwt_expiration": jwt_expiration
        })
        set_access_token_cookie(resp, access_token, jwt_expiration)
        set_refresh_token_cookie(resp, refresh_token)
        return resp
        

    
class UserLogout(APIView):
    def get(self,request):
        logger.info(f"User logout for user_id: {request.user.id if hasattr(request, 'user') else 'Unknown'}")
        response = Response({'message': 'Logged out'})
        clear_auth_cookies(response)
        return response


class ValidateToken(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        service_id = request.headers.get("X-Service-ID")
        token = get_access_token_from_request(request, prefer_cookie=True)
        logger.debug(
            "Token validation attempt - Service ID: %s, Token present: %s",
            service_id,
            bool(token),
        )
        if not token:
            logger.warning("Token validation failed: No token provided")
            return Response(
                {"detail": "No token provided"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = validate_token_payload(
                decode_token(token),
                expected_token_type=TOKEN_TYPE_ACCESS,
                allow_legacy=True,
            )
            logger.debug(f"Token decoded successfully for user_id: {payload.get('user_id')}")
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
                                        status=status.HTTP_403_FORBIDDEN)
                    logger.debug(f"Token validation successful for user_id: {user_id}, service_id: {service_id}")
                except psycopg2.Error as e:
                    logger.error(f"Database error during token validation: {str(e)}", exc_info=True)
                    raise APIException({"detail":'Database query error!'})
                finally:
                    cur.close()
                    conn.close()

            logger.info(f"Token validated successfully for user_id: {user_id}")
            response = Response(
                {"user_id": payload["user_id"], "user_name": payload["user_name"]},
                status=status.HTTP_200_OK
            )
            # Add custom headers for Nginx to consume
            response["X-User-Id"] = payload["user_id"]
            response["X-User-Name"] = payload.get("user_name", "unknown")
            return response
        except jwt.ExpiredSignatureError:
            logger.warning("Token validation failed: Token signature expired")
            return Response({"detail":"Token expired"},
                            status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            logger.warning("Token validation failed: Invalid token")
            return Response({"detail":"Invalid token"},
                            status=status.HTTP_401_UNAUTHORIZED)
        except AuthenticationFailed as e:
            logger.warning("Token validation failed: %s", str(e))
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {str(e)}", exc_info=True)
            return Response({"detail": str(e)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class RefreshToken(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        refresh_token = request.data.get("refresh_token") or get_refresh_token_from_request(
            request,
            prefer_cookie=True,
        )
        if not refresh_token:
            logger.warning("Token refresh attempted without refresh_token")
            return Response({"detail": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

        logger.debug("Attempting to refresh token")
        try:
            payload = validate_token_payload(
                decode_token(refresh_token),
                expected_token_type=TOKEN_TYPE_REFRESH,
                allow_legacy=True,
            )
            user_id = payload["user_id"]
            user_context = fetch_user_auth_context(user_id)
            if not user_context:
                logger.warning("Token refresh failed: User not found for user_id=%s", user_id)
                return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

            new_access_token = create_access_token(
                user_id,
                user_context["user_name"],
                user_context["jwt_expiration"],
            )

            logger.info(f"Token refreshed successfully for user_id: {payload.get('user_id')}")
            response = Response(
                {"access_token": new_access_token},
                status=status.HTTP_200_OK,
            )
            set_access_token_cookie(
                response,
                new_access_token,
                user_context["jwt_expiration"],
            )
            set_refresh_token_cookie(response, refresh_token, payload=payload)
            return response

        except jwt.ExpiredSignatureError:
            logger.warning("Token refresh failed: Token expired")
            return Response({"detail": "Token expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            logger.warning("Token refresh failed: Invalid token")
            return Response({"detail": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)
        except AuthenticationFailed as e:
            logger.warning("Token refresh failed: %s", str(e))
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
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
            cur.execute(
                """
                SELECT
                    usr_id,
                    usr_login,
                    usr_admin,
                    usr_access,
                    created_at,
                    jwt_expiration,
                    COALESCE(usr_tasy, FALSE)
                FROM usr_info
                ORDER BY usr_id
                """
            )
            users_data = cur.fetchall()
            users_list = [
                {
                    "id": row[0], 
                    "username": row[1], 
                    "is_admin": row[2], 
                    "access": row[3],
                    "created_at": row[4].isoformat() if row[4] else None,
                    "jwt_expiration": normalize_jwt_expiration(row[5]),
                    "is_tasy": bool(row[6]),
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
        is_tasy = bool(data.get('is_tasy', False))
        usr_access = data.get('access', "")
        jwt_expiration = normalize_jwt_expiration(data.get('jwt_expiration'))

        user_name = str(user_name or "").strip()

        if not user_name:
            logger.warning(f"Admin {admin_user['user_id']} attempted to create user without user_name")
            raise ValidationError({"detail":"Missing 'user_name' field."})
        if not is_tasy and not user_pass:
            logger.warning(f"Admin {admin_user['user_id']} attempted to create user without user_pass")
            raise ValidationError({"detail":"Missing 'user_pass' field."})
        
        if is_tasy:
            user_name = normalize_tasy_username(user_name)
            user_pass_processed = TASY_PASSWORD_PLACEHOLDER
        else:
            validate_password(user_pass)
            user_name = user_name.lower()
            user_pass_processed = user_pass

        logger.info(
            "Admin %s creating new user: %s (Tasy: %s)",
            admin_user["user_id"],
            user_name,
            is_tasy,
        )

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute(
                "SELECT usr_id FROM usr_info WHERE UPPER(usr_login) = UPPER(%s)",
                (user_name,),
            )
            if cur.fetchone():
                logger.warning(f"User creation failed by admin {admin_user['user_id']}: Username '{user_name}' already in use")
                raise ValidationError({"detail":f"Username '{user_name}' already in use."})

            cur.execute("""
                INSERT INTO usr_info (
                    usr_login,
                    usr_password,
                    usr_admin,
                    usr_access,
                    created_at,
                    jwt_expiration,
                    usr_tasy
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING usr_id
            """, (user_name, user_pass_processed, bool(is_admin), usr_access, datetime.now(tz=timezone.utc), jwt_expiration, is_tasy))
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
                "user": {
                    "id": new_user_id,
                    "username": user_name,
                    "is_admin": bool(is_admin),
                    "access": usr_access,
                    "jwt_expiration":jwt_expiration,
                    "is_tasy": is_tasy,
                }
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
            cur.execute(
                """
                SELECT
                    usr_id,
                    usr_login,
                    usr_admin,
                    usr_access,
                    created_at,
                    jwt_expiration,
                    COALESCE(usr_tasy, FALSE)
                FROM usr_info
                WHERE usr_id = %s
                """,
                (target_user_id,),
            )
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
                "jwt_expiration": normalize_jwt_expiration(user_data[5]),
                "is_tasy": bool(user_data[6]),
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
        is_admin = data.get('is_admin')
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
            update_values.append(normalize_jwt_expiration(jwt_expiration))
        
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
            cur.execute(
                """
                SELECT
                    usr_id,
                    usr_login,
                    usr_admin,
                    usr_access,
                    jwt_expiration,
                    COALESCE(usr_tasy, FALSE)
                FROM usr_info
                WHERE usr_id = %s
                """,
                (target_user_id,),
            )
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
                "jwt_expiration": normalize_jwt_expiration(updated_user[4]),
                "is_tasy": bool(updated_user[5]),
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


class AdminUserServiceAccessOperations(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def _change_access(self, request, target_user_id, service_id, *, grant):
        admin_user = get_admin_user_from_token(request)
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False

        try:
            cur.execute(
                "SELECT 1 FROM services_info WHERE srv_id = %s FOR SHARE",
                (service_id,),
            )
            if not cur.fetchone():
                return Response(
                    {"detail": "Service not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            cur.execute(
                "SELECT usr_login, usr_access FROM usr_info WHERE usr_id = %s FOR UPDATE",
                (target_user_id,),
            )
            user = cur.fetchone()
            if not user:
                return Response(
                    {"detail": "User not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            username, raw_access = user
            access_ids = []
            for item in str(raw_access or "").split(","):
                normalized_item = item.strip()
                if normalized_item and normalized_item not in access_ids:
                    access_ids.append(normalized_item)

            service_id_text = str(service_id)
            had_access = service_id_text in access_ids
            if grant and not had_access:
                access_ids.append(service_id_text)
            elif not grant and had_access:
                access_ids.remove(service_id_text)

            changed = had_access != grant
            if changed:
                cur.execute(
                    "UPDATE usr_info SET usr_access = %s WHERE usr_id = %s",
                    (",".join(access_ids), target_user_id),
                )

            if not grant:
                cur.execute(
                    "DELETE FROM usr_favorite_services WHERE usr_id = %s AND srv_id = %s",
                    (target_user_id, service_id),
                )

            conn.commit()
            logger.info(
                "Admin %s %s service %s for user %s",
                admin_user["user_id"],
                "granted" if grant else "revoked",
                service_id,
                target_user_id,
            )
            return Response(
                {
                    "changed": changed,
                    "service_id": service_id,
                    "has_access": grant,
                    "user": {
                        "id": target_user_id,
                        "username": username,
                        "access": ",".join(access_ids),
                    },
                }
            )
        except psycopg2.Error as db_error:
            conn.rollback()
            logger.error(
                "Database error changing service access for user %s: %s",
                target_user_id,
                db_error,
                exc_info=True,
            )
            raise APIException({"detail": f"Database error: {db_error}"})
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    def put(self, request, target_user_id, service_id):
        return self._change_access(
            request,
            target_user_id,
            service_id,
            grant=True,
        )

    def delete(self, request, target_user_id, service_id):
        return self._change_access(
            request,
            target_user_id,
            service_id,
            grant=False,
        )


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
        token = get_access_token_from_request(request, prefer_cookie=True)
        if not token:
            logger.warning("UserMe: No token provided")
            return Response({"detail": "No token provided"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = validate_token_payload(
                decode_token(token),
                expected_token_type=TOKEN_TYPE_ACCESS,
                allow_legacy=True,
            )
            user_id = payload["user_id"]
            user_context = fetch_user_auth_context(user_id)
            if not user_context:
                return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

            logger.info(f"UserMe: returned data for user_id {user_id}")
            return Response({
                "user_id": user_id,
                "user_name": user_context["user_name"],
                "is_admin": user_context["is_admin"]
            }, status=status.HTTP_200_OK)

        except jwt.ExpiredSignatureError:
            return Response({"detail": "Token expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            return Response({"detail": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)
        except AuthenticationFailed as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error in UserMe: {str(e)}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
