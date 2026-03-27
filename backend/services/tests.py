from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from .views import ServiceNextIdManager


class ServiceNextIdManagerTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(id=99, is_authenticated=True)

    @patch("services.views.get_admin_user_from_token")
    @patch("services.views.get_db_connection")
    def test_returns_highest_service_id_plus_one(
        self,
        mock_get_db_connection,
        mock_get_admin_user_from_token,
    ):
        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur
        cur.fetchone.return_value = (18,)
        mock_get_db_connection.return_value = conn

        request = self.factory.get("/api_gateway/v1/services/next-id/")
        request.user = self.user

        response = ServiceNextIdManager.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["next_service_id"], 18)
        cur.execute.assert_called_once_with(
            "SELECT COALESCE(MAX(srv_id), 0) + 1 FROM services_info"
        )
        mock_get_admin_user_from_token.assert_called_once_with(request)
        cur.close.assert_called_once()
        conn.close.assert_called_once()

    @patch("services.views.get_admin_user_from_token")
    @patch("services.views.get_db_connection")
    def test_returns_one_when_table_is_empty(
        self,
        mock_get_db_connection,
        mock_get_admin_user_from_token,
    ):
        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur
        cur.fetchone.return_value = (1,)
        mock_get_db_connection.return_value = conn

        request = self.factory.get("/api_gateway/v1/services/next-id/")
        request.user = self.user

        response = ServiceNextIdManager.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["next_service_id"], 1)
