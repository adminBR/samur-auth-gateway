from .reference import GENERATED_PATHS_PLACEHOLDER


class NginxConfigBuilder:
    """Builds nginx configuration blocks from service data."""

    @staticmethod
    def build_nginx_config(
        services_data: list[dict],
        header: str = "",
    ) -> str:
        """Build complete nginx configuration from service blocks."""
        generated_blocks: list[str] = []

        for service in services_data:
            if not service.get("rt_enabled"):
                continue

            srv_name = service.get("srv_name", "Unknown Service")
            srv_id = service.get("srv_id", "Unknown Service")
            service_blocks: list[str] = []

            if service.get("rt_frontend_block"):
                service_blocks.append(
                    "# ------------------------------ #\n"
                    f"# ID:{srv_id} {srv_name}\n"
                    "# ------------------------------ #"
                )
                service_blocks.append(service["rt_frontend_block"].rstrip())

            if service.get("rt_backend_block"):
                service_blocks.append(f"    # {srv_name} Backend")
                service_blocks.append(service["rt_backend_block"].rstrip())

            if service_blocks:
                generated_blocks.append("\n".join(service_blocks))

        generated_content = "\n\n".join(generated_blocks).strip()
        base_header = header.strip()

        if not base_header:
            return generated_content + ("\n" if generated_content else "")

        if GENERATED_PATHS_PLACEHOLDER in base_header:
            return (
                base_header.replace(GENERATED_PATHS_PLACEHOLDER, generated_content).rstrip()
                + "\n"
            )

        if not generated_content:
            return base_header + "\n"

        return f"{base_header}\n\n{generated_content}\n"
