from typing import Optional


class NginxConfigBuilder:
    """Builds nginx configuration blocks from service and API data."""
    
    @staticmethod
    def build_nginx_config(
        services_data: list[dict],
        header: str = "",
        footer: str = "",
    ) -> str:
        """Build complete nginx configuration from services data."""
        config = header + "\n" if header else ""
        
        for service in services_data:
            # Skip disabled services
            if not service.get('rt_enabled'):
                continue
                
            srv_name = service.get('srv_name', 'Unknown Service')
            srv_id = service.get('srv_id', 'Unknown Service')
            
            # Add frontend block if exists
            if service.get('rt_frontend_block'):
                config += f"\n# —————————————————————————————— #\n# ID:{srv_id} {srv_name}\n# —————————————————————————————— #\n"
                config += service['rt_frontend_block'].rstrip() + "\n\n"
            
            # Add backend block if exists
            if service.get('rt_backend_block'):
                config += f"    # {srv_name} Backend\n"
                config += service['rt_backend_block'].rstrip() + "\n\n"
        
        config += footer + "\n" if footer else ""
        return config
