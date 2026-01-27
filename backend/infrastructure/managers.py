import paramiko
from rest_framework.exceptions import APIException


class SshManager:
    """Handles SSH connections and remote server operations."""
    
    def __init__(self, hostname: str, username: str, password: str):
        self.hostname = hostname
        self.username = username
        self.password = password
    
    def test_nginx_syntax(self) -> dict:
        """Test nginx configuration syntax on remote server."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            client.connect(
                hostname=self.hostname,
                username=self.username,
                password=self.password
            )
        except Exception as e:
            raise APIException(f"Can't connect to SSH: {e}")
        
        try:
            command = f'echo {self.password} | sudo -S nginx -t'
            stdin, stdout, stderr = client.exec_command(command)
            return_string = stderr.read().decode()
            
            return {
                "syntax_status": "syntax is ok" in return_string,
                "test_status": "test is successful" in return_string,
                "output": return_string
            }
        finally:
            client.close()