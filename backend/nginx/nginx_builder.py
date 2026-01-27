from typing import Optional

class NginxConfigBuilder:
    """Builds nginx configuration blocks from service and API data."""
    
    @staticmethod
    def build_location_block(
        location_path: str,
        service_id: int,
        proxy_pass: str,
        proxy_params: list[str],
        custom_params: list[str],
    ) -> str:
        """Build a single location block for frontend service."""
        location_path = location_path.strip("/")
        
        # Format proxy params - ensure single semicolon
        formatted_proxy_params = "\n".join(
            '        ' + line.strip().rstrip(';') + ';' for line in proxy_params if line.strip()
        )
        
        # Format custom params - ensure single semicolon
        formatted_custom_params = "\n".join(
            '        ' + line.strip().rstrip(';') + ';' for line in custom_params if line.strip()
        )
        
        # Build location block with proper spacing
        location_block = f"""    location /{location_path}/ {{
        set $service_id {service_id};
        auth_request /_auth;
        error_page 401 = @redirect_login;

        proxy_pass {proxy_pass};
"""
        if formatted_proxy_params:
            location_block += formatted_proxy_params + "\n"
        
        if formatted_custom_params:
            location_block += "\n" + formatted_custom_params + "\n"
        
        location_block += "    }\n"
        return location_block

    @staticmethod
    def build_api_location_block(
        location_path: str,
        service_id: int,
        proxy_pass: str,
        proxy_params: list[str],
        custom_params: list[str],
    ) -> str:
        """Build a single location block for backend API service."""
        location_path = location_path.strip("/")
        
        # Format proxy params - ensure single semicolon
        formatted_proxy_params = "\n".join(
            '        ' + line.strip().rstrip(';') + ';' for line in proxy_params if line.strip()
        )
        
        # Format custom params - ensure single semicolon
        formatted_custom_params = "\n".join(
            '        ' + line.strip().rstrip(';') + ';' for line in custom_params if line.strip()
        )
        
        # Build location block with proper spacing
        location_block = f"""    location /{location_path}/ {{
        set $service_id {service_id};
        auth_request /_auth;
        error_page 401 = @redirect_login;

        proxy_pass {proxy_pass};
"""
        if formatted_proxy_params:
            location_block += formatted_proxy_params + "\n"
        
        if formatted_custom_params:
            location_block += "\n" + formatted_custom_params + "\n"
        
        location_block += "    }\n"
        return location_block

    @staticmethod
    def build_nginx_config(
        services_data: list[dict],
        header: str = "",
        footer: str = "",
    ) -> str:
        """Build complete nginx configuration from services data."""
        config = header + "\n" if header else ""
        
        for service in services_data:
            srv_name = service.get('srv_name', 'Unknown Service')
            srv_id = service.get('srv_id', 'Unknown Service')
            
            # Build frontend location block if frontend config exists
            if service.get('rt_location_path'):
                config += f"\n# —————————————————————————————— #\n# ID:{srv_id} {srv_name}\n# —————————————————————————————— #\n"
                frontend_block = NginxConfigBuilder.build_location_block(
                    location_path=service['rt_location_path'],
                    service_id=int(service['srv_id']),
                    proxy_pass=service.get('rt_proxy_pass', ''),
                    proxy_params=(
                        service.get('rt_proxy_params', '').split('\n')
                        if isinstance(service.get('rt_proxy_params'), str)
                        else service.get('rt_proxy_params', [])
                    ),
                    custom_params=(
                        service.get('rt_custom_params', '').split('\n')
                        if isinstance(service.get('rt_custom_params'), str)
                        else service.get('rt_custom_params', [])
                    ),
                )
                config += frontend_block + "\n"
            
            # Build backend location block if backend config exists
            if service.get('rt_backend_location_path'):
                config += f"    # {srv_name}\n"
                backend_block = NginxConfigBuilder.build_api_location_block(
                    location_path=service['rt_backend_location_path'],
                    service_id=int(service['srv_id']),
                    proxy_pass=service.get('rt_backend_proxy_pass', ''),
                    proxy_params=(
                        service.get('rt_backend_proxy_params', '').split('\n')
                        if isinstance(service.get('rt_backend_proxy_params'), str)
                        else service.get('rt_backend_proxy_params', [])
                    ),
                    custom_params=(
                        service.get('rt_backend_custom_params', '').split('\n')
                        if isinstance(service.get('rt_backend_custom_params'), str)
                        else service.get('rt_backend_custom_params', [])
                    ),
                )
                config += backend_block + "\n"
        
        config += footer + "\n" if footer else ""
        return config
