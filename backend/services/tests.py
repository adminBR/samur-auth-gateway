from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .views import ServiceNextIdManager, fetch_user_accessible_service_ids


class ServiceAccessTests(TestCase):
    def test_admin_receives_every_service_without_explicit_access(self):
        cur = MagicMock()
        cur.fetchone.return_value = (True, "")
        cur.fetchall.return_value = [(2,), (5,), (9,)]

        service_ids = fetch_user_accessible_service_ids(cur, user_id=1)

        self.assertEqual(service_ids, [2, 5, 9])
        cur.execute.assert_any_call("SELECT srv_id FROM services_info ORDER BY srv_id")

    def test_normal_user_keeps_explicit_service_access(self):
        cur = MagicMock()
        cur.fetchone.return_value = (False, "2,5")

        service_ids = fetch_user_accessible_service_ids(cur, user_id=7)

        self.assertEqual(service_ids, [2, 5])
        self.assertEqual(cur.execute.call_count, 1)


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
        force_authenticate(request, user=self.user)

        response = ServiceNextIdManager.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["next_service_id"], 18)
        cur.execute.assert_called_once_with(
            "SELECT COALESCE(MAX(srv_id), 0) + 1 FROM services_info"
        )
        mock_get_admin_user_from_token.assert_called_once()
        authenticated_request = mock_get_admin_user_from_token.call_args.args[0]
        self.assertEqual(authenticated_request.path, request.path)
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
        force_authenticate(request, user=self.user)

        response = ServiceNextIdManager.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["next_service_id"], 1)
