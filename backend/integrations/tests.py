import os
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.test import APIRequestFactory

from .authentication import (
    FormManagerApiKeyAuthentication,
    IntegrationNotConfigured,
)
from .views import (
    FormManagerNginxPublishView,
    FormManagerUserPageAccessView,
    _build_frontend_block,
    _managed_slug,
    _parse_access_ids,
    _validate_slug,
)


class FormManagerAuthenticationTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.authentication = FormManagerApiKeyAuthentication()

    @patch.dict(os.environ, {"FORMMANAGER_API_KEY": "integration-secret"})
    def test_accepts_matching_bearer_key(self):
        request = self.factory.get(
            "/api_gateway/v1/integrations/formmanager/users/",
            HTTP_AUTHORIZATION="Bearer integration-secret",
        )

        principal, auth = self.authentication.authenticate(request)

        self.assertTrue(principal.is_authenticated)
        self.assertEqual(principal.id, "formmanager")
        self.assertIsNone(auth)

    @patch.dict(os.environ, {"FORMMANAGER_API_KEY": "integration-secret"})
    def test_rejects_wrong_key(self):
        request = self.factory.get(
            "/api_gateway/v1/integrations/formmanager/users/",
            HTTP_AUTHORIZATION="Bearer wrong-secret",
        )

        with self.assertRaises(AuthenticationFailed):
            self.authentication.authenticate(request)

    @patch.dict(os.environ, {}, clear=True)
    def test_reports_missing_server_key(self):
        request = self.factory.get(
            "/api_gateway/v1/integrations/formmanager/users/",
            HTTP_AUTHORIZATION="Bearer any-key",
        )

        with self.assertRaises(IntegrationNotConfigured):
            self.authentication.authenticate(request)


class FormManagerRoutingTests(SimpleTestCase):
    def test_generated_block_has_unique_service_id_and_managed_path(self):
        block = _build_frontend_block(
            42,
            "/formmanager/form1/",
            "http://formmanager.internal:8000",
        )

        self.assertIn("location /formmanager/form1/", block)
        self.assertIn("set $service_id 42;", block)
        self.assertIn("proxy_pass http://formmanager.internal:8000;", block)
        self.assertEqual(_managed_slug(block, "/formmanager"), "form1")

    def test_slug_rejects_nested_or_nginx_syntax(self):
        for slug in ("formmanager/form1", "Form1", "form1; return 200"):
            with self.subTest(slug=slug):
                with self.assertRaises(ValidationError):
                    _validate_slug(slug)

    def test_access_parser_preserves_order_and_removes_duplicates(self):
        self.assertEqual(_parse_access_ids("2,5,2,invalid,9"), [2, 5, 9])


class FakeCursor:
    def __init__(self, raw_access):
        self.raw_access = raw_access
        self.query = ""
        self.executions = []

    def execute(self, query, params=None):
        self.query = " ".join(query.split())
        self.executions.append((self.query, params))

    def fetchone(self):
        if "FROM services_info" in self.query:
            return (
                "location /formmanager/form1/ {\n"
                "    set $service_id 42;\n"
                "}",
            )
        if "FROM usr_info" in self.query:
            return ("alice", self.raw_access)
        return None

    def close(self):
        return None


class FakeConnection:
    def __init__(self, raw_access):
        self.cursor_instance = FakeCursor(raw_access)
        self.autocommit = True
        self.committed = False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.committed = True

    def rollback(self):
        return None

    def close(self):
        return None


class FormManagerAccessMutationTests(SimpleTestCase):
    @patch("integrations.views.get_db_connection")
    def test_grant_adds_page_without_replacing_other_access(self, get_connection):
        connection = FakeConnection("2,5")
        get_connection.return_value = connection

        response = FormManagerUserPageAccessView()._change_access(
            user_id=7,
            service_id=42,
            grant=True,
        )

        update = next(
            execution
            for execution in connection.cursor_instance.executions
            if execution[0].startswith("UPDATE usr_info")
        )
        self.assertEqual(update[1], ("2,5,42", 7))
        self.assertTrue(response.data["changed"])
        self.assertTrue(connection.committed)

    @patch("integrations.views.get_db_connection")
    def test_revoke_removes_only_requested_page(self, get_connection):
        connection = FakeConnection("2,42,5")
        get_connection.return_value = connection

        response = FormManagerUserPageAccessView()._change_access(
            user_id=7,
            service_id=42,
            grant=False,
        )

        update = next(
            execution
            for execution in connection.cursor_instance.executions
            if execution[0].startswith("UPDATE usr_info")
        )
        self.assertEqual(update[1], ("2,5", 7))
        self.assertTrue(response.data["changed"])
        self.assertTrue(
            any(
                query.startswith("DELETE FROM usr_favorite_services")
                for query, _ in connection.cursor_instance.executions
            )
        )


class FormManagerPublishTests(SimpleTestCase):
    @patch("integrations.views.publish_current_nginx_config")
    def test_publish_returns_explicit_success_after_deployment(self, publish):
        publish.return_value = (
            {
                "message": "Configuration published.",
                "status_label": "passed",
                "deployment": {
                    "deployed": True,
                    "test_status": True,
                    "restart_status": True,
                },
            },
            200,
        )
        request = APIRequestFactory().post(
            "/api_gateway/v1/integrations/formmanager/nginx/publish/",
            {},
            format="json",
        )

        response = FormManagerNginxPublishView().post(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertTrue(response.data["deployment"]["deployed"])
