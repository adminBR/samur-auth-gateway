import paramiko
from rest_framework.exceptions import APIException
import shlex
import uuid
from typing import Dict, Optional, Tuple


class SshManager:
    """Handles SSH connections and remote server operations."""
    
    def __init__(
        self,
        hostname: str,
        username: str,
        password: Optional[str] = None,
        *,
        port: int = 22,
        key_filename: Optional[str] = None,
    ):
        self.hostname = hostname
        self.username = username
        self.password = password
        self.port = port
        self.key_filename = key_filename
    
    def _connect(self) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connect_kwargs = {
            "hostname": self.hostname,
            "port": self.port,
            "username": self.username,
            "timeout": 15,
        }
        if self.key_filename:
            connect_kwargs["key_filename"] = self.key_filename
        elif self.password:
            connect_kwargs["password"] = self.password
        else:
            raise APIException("Provide password or key_filename for SSH authentication")
        try:
            client.connect(**connect_kwargs)
            return client
        except Exception as exc:
            client.close()
            raise APIException(f"Can't connect to SSH: {exc}")
    
    def _build_sudo_command(self, command: str) -> str:
        quoted = shlex.quote(command)
        if self.password:
            return f"echo {shlex.quote(self.password)} | sudo -S bash -c {quoted}"
        return f"sudo bash -c {quoted}"
    
    def _run_command(self, client: paramiko.SSHClient, command: str) -> Tuple[str, str, int]:
        stdin, stdout, stderr = client.exec_command(command)
        out = stdout.read().decode()
        err = stderr.read().decode()
        exit_code = stdout.channel.recv_exit_status()
        return out, err, exit_code
    
    def _run_nginx_test(self, client: paramiko.SSHClient) -> Dict[str, object]:
        cmd = self._build_sudo_command("nginx -t")
        out, err, _ = self._run_command(client, cmd)
        output = f"{out}{err}".strip()
        lowered = output.lower()
        return {
            "syntax_status": "syntax is ok" in lowered,
            "test_status": "test is successful" in lowered,
            "output": output,
        }
    
    def test_nginx_syntax(self) -> Dict[str, object]:
        client = None
        try:
            client = self._connect()
            return self._run_nginx_test(client)
        finally:
            if client:
                client.close()
    
    def deploy_nginx_config(self, config_text: str, remote_path: str) -> Dict[str, object]:
        temp_path = f"/tmp/nginx-config-{uuid.uuid4().hex}.conf"
        client = None
        try:
            client = self._connect()
            sftp = client.open_sftp()
            with sftp.file(temp_path, "w") as remote_file:
                remote_file.write(config_text)
            sftp.close()
            
            move_cmd = self._build_sudo_command(f"mv {temp_path} {remote_path}")
            _, move_err, move_code = self._run_command(client, move_cmd)
            if move_code != 0:
                raise APIException(f"Failed to move config: {move_err or 'unknown error'}")
            
            chmod_cmd = self._build_sudo_command(f"chmod 644 {remote_path}")
            _, chmod_err, chmod_code = self._run_command(client, chmod_cmd)
            if chmod_code != 0:
                raise APIException(f"Failed to chmod config: {chmod_err or 'unknown error'}")
            
            return self._run_nginx_test(client)
        finally:
            if client:
                try:
                    client.exec_command(f"rm -f {temp_path}")
                except Exception:
                    pass
                client.close()