from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import jwt

from utils.jwt import (
    TOKEN_TYPE_ACCESS,
    decode_token,
    get_access_token_from_request,
    validate_token_payload,
)


class CustomUser:
    def __init__(self, user_id, username):
        self.id = user_id
        self.username = username
        self.is_authenticated = True  # Required for DRF permission checks


class JWTCustomAuth(BaseAuthentication):
    def authenticate(self, request):
        token = get_access_token_from_request(request)
        if not token:
            return None

        try:
            payload = validate_token_payload(
                decode_token(token),
                expected_token_type=TOKEN_TYPE_ACCESS,
                allow_legacy=True,
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token expired.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Invalid token.")

        user_id = payload.get("user_id")
        username = payload.get("user_name")
        
        if not user_id or not username:
            raise AuthenticationFailed("Invalid token payload.")

        # You could validate against the DB here again, but optional
        return (CustomUser(user_id, username), None)
