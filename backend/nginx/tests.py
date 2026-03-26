from django.test import SimpleTestCase

from .nginx_builder import NginxConfigBuilder
from .reference import GENERATED_PATHS_PLACEHOLDER


class NginxConfigBuilderTests(SimpleTestCase):
    def test_build_nginx_config_replaces_generated_paths_placeholder(self):
        header = (
            "server {\n"
            "    # System generated paths\n"
            f"    {GENERATED_PATHS_PLACEHOLDER}\n"
            "}\n"
        )
        services_data = [
            {
                "srv_id": 6,
                "srv_name": "Painel Pacientes CPOE",
                "rt_frontend_block": "location /painel_pacientes_cpoe/ {\n    auth_request /_auth;\n}",
                "rt_backend_block": "location /api/enfermaria_status_cpoe/ {\n    error_page 401 = @api_err401;\n}",
                "rt_enabled": True,
            }
        ]

        config = NginxConfigBuilder.build_nginx_config(
            services_data=services_data,
            header=header,
        )

        self.assertNotIn(GENERATED_PATHS_PLACEHOLDER, config)
        self.assertIn("location /painel_pacientes_cpoe/", config)
        self.assertIn("location /api/enfermaria_status_cpoe/", config)
        self.assertTrue(config.rstrip().endswith("}"))

    def test_build_nginx_config_keeps_valid_header_when_no_services_exist(self):
        header = (
            "server {\n"
            "    # System generated paths\n"
            f"    {GENERATED_PATHS_PLACEHOLDER}\n"
            "}\n"
        )

        config = NginxConfigBuilder.build_nginx_config(
            services_data=[],
            header=header,
        )

        self.assertNotIn(GENERATED_PATHS_PLACEHOLDER, config)
        self.assertTrue(config.rstrip().endswith("}"))
