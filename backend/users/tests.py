from unittest.mock import patch

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APIClient, APIRequestFactory

from users.auth import JWTCustomAuth
from utils.jwt import (
    TOKEN_TYPE_ACCESS,
    create_access_token,
    create_refresh_token,
    decode_token,
)


class AuthFlowTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    @patch(
        "users.views.fetch_user_auth_context",
        return_value={
            "user_name": "alice",
            "is_admin": False,
            "jwt_expiration": "1",
        },
    )
    def test_refresh_endpoint_returns_new_access_token_and_sets_cookies(self, _mock_context):
        refresh_token = create_refresh_token(1, "alice")

        response = self.client.post(
            "/api_gateway/v1/users/refresh/",
            {"refresh_token": refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.data)
        self.assertIn(settings.AUTH_ACCESS_TOKEN_COOKIE_NAME, response.cookies)
        self.assertIn(settings.AUTH_REFRESH_TOKEN_COOKIE_NAME, response.cookies)

        access_payload = decode_token(response.data["access_token"])
        self.assertEqual(access_payload["token_type"], TOKEN_TYPE_ACCESS)
        self.assertEqual(access_payload["user_id"], 1)
        self.assertEqual(access_payload["user_name"], "alice")

    @patch(
        "users.views.fetch_user_auth_context",
        return_value={
            "user_name": "cookie-user",
            "is_admin": True,
            "jwt_expiration": "1",
        },
    )
    def test_me_endpoint_returns_user_from_cookie(self, _mock_context):
        access_token = create_access_token(7, "cookie-user", "1")
        self.client.cookies[settings.AUTH_ACCESS_TOKEN_COOKIE_NAME] = access_token

        response = self.client.get("/api_gateway/v1/users/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "user_id": 7,
                "user_name": "cookie-user",
                "is_admin": True,
            },
        )

    def test_jwt_custom_auth_accepts_access_token_cookie(self):
        request = APIRequestFactory().get("/api_gateway/v1/services/")
        request.COOKIES[settings.AUTH_ACCESS_TOKEN_COOKIE_NAME] = create_access_token(
            99,
            "cookie-auth",
            "1",
        )

        user, _ = JWTCustomAuth().authenticate(request)

        self.assertEqual(user.id, 99)
        self.assertEqual(user.username, "cookie-auth")

    def test_validate_endpoint_returns_401_when_no_token_is_provided(self):
        response = self.client.get("/api_gateway/v1/users/validate")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["detail"], "No token provided")

    @patch("users.views.get_db_connection")
    def test_validate_endpoint_returns_403_when_user_lacks_service_access(
        self,
        mock_get_db_connection,
    ):
        conn = mock_get_db_connection.return_value
        cur = conn.cursor.return_value
        cur.fetchone.return_value = ("2,3",)

        access_token = create_access_token(7, "blocked-user", "1")
        self.client.cookies[settings.AUTH_ACCESS_TOKEN_COOKIE_NAME] = access_token

        response = self.client.get(
            "/api_gateway/v1/users/validate",
            HTTP_X_SERVICE_ID="9",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["detail"], "Access denied to this service")
