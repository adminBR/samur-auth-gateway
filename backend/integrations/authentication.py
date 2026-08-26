import secrets
from dataclasses import dataclass

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import APIException, AuthenticationFailed

from utils.env import env


class IntegrationNotConfigured(APIException):
    status_code = 503
    default_detail = "FormManager integration API key is not configured."
    default_code = "integration_not_configured"


@dataclass(frozen=True)
class FormManagerPrincipal:
    id: str = "formmanager"
    username: str = "formmanager-integration"

    @property
    def is_authenticated(self) -> bool:
        return True


class FormManagerApiKeyAuthentication(BaseAuthentication):
    """Authenticates the FormManager service with a dedicated bearer key."""

    keyword = "Bearer"

    def authenticate(self, request):
        configured_key = str(env("FORMMANAGER_API_KEY", "") or "").strip()
        if not configured_key:
            raise IntegrationNotConfigured()

        authorization = get_authorization_header(request).split()
        if len(authorization) != 2 or authorization[0].lower() != b"bearer":
            raise AuthenticationFailed("A FormManager bearer API key is required.")

        try:
            provided_key = authorization[1].decode("utf-8")
        except UnicodeError as exc:
            raise AuthenticationFailed("Invalid FormManager API key.") from exc

        if not secrets.compare_digest(provided_key, configured_key):
            raise AuthenticationFailed("Invalid FormManager API key.")

        return FormManagerPrincipal(), None

    def authenticate_header(self, request):
        return self.keyword
