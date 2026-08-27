import logging
import shlex
import uuid
from typing import Callable, Dict, List, Optional, Tuple

import paramiko
from rest_framework.exceptions import APIException


ProgressCallback = Optional[Callable[[Dict[str, object]], None]]
logger = logging.getLogger(__name__)


class SshManager:
    """Handles SSH connections and transactional NGINX deployments."""

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

    def _run_command(
        self,
        client: paramiko.SSHClient,
        command: str,
        stdin_text: Optional[str] = None,
    ) -> Tuple[str, str, int]:
        stdin, stdout, stderr = client.exec_command(command)
        if stdin_text:
            stdin.write(stdin_text)
            stdin.flush()
            stdin.channel.shutdown_write()
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        return out, err, exit_code

    def _run_sudo_command(
        self,
        client: paramiko.SSHClient,
        command: str,
    ) -> Tuple[str, str, int]:
        password_flag = "-S" if self.password else "-n"
        sudo_command = f"sudo {password_flag} -p '' bash -c {shlex.quote(command)}"
        stdin_text = f"{self.password}\n" if self.password else None
        return self._run_command(client, sudo_command, stdin_text)

    @staticmethod
    def _combined_output(out: str, err: str) -> str:
        return "\n".join(part.strip() for part in (out, err) if part.strip())

    def _run_nginx_test(self, client: paramiko.SSHClient) -> Dict[str, object]:
        out, err, exit_code = self._run_sudo_command(client, "nginx -t")
        output = self._combined_output(out, err)
        passed = exit_code == 0
        return {
            "syntax_status": passed,
            "test_status": passed,
            "exit_code": exit_code,
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

    def deploy_nginx_config(
        self,
        config_text: str,
        remote_path: str,
        *,
        restart_command: str = "systemctl reload nginx",
        on_progress: ProgressCallback = None,
    ) -> Dict[str, object]:
        deployment_id = uuid.uuid4().hex
        temp_path = f"/tmp/nginx-config-{deployment_id}.conf"
        backup_path = f"{remote_path}.codex-backup-{deployment_id}"
        steps: List[Dict[str, object]] = []
        client = None
        had_previous_config = False
        preserve_backup = False

        def report(step_id: str, label: str, step_status: str, output: str = "") -> None:
            step = {
                "id": step_id,
                "label": label,
                "status": step_status,
                "output": output,
            }
            existing = next((item for item in steps if item["id"] == step_id), None)
            if existing:
                existing.update(step)
                emitted_step = dict(existing)
            else:
                steps.append(step)
                emitted_step = dict(step)
            logger.info(
                "NGINX deployment step=%s status=%s label=%s%s",
                step_id,
                step_status,
                label,
                f" output={output[:500]}" if output else "",
            )
            if on_progress:
                on_progress(emitted_step)

        def cleanup() -> None:
            if not client:
                return
            try:
                self._run_command(client, f"rm -f -- {shlex.quote(temp_path)}")
            except Exception:
                pass
            if not preserve_backup:
                try:
                    self._run_sudo_command(client, f"rm -f -- {shlex.quote(backup_path)}")
                except Exception:
                    pass

        def build_result(
            *,
            deployed: bool,
            syntax_status: bool = False,
            restart_status: bool = False,
            rolled_back: bool = False,
            rollback_status: bool = False,
        ) -> Dict[str, object]:
            cleanup()
            output = "\n\n".join(
                str(step["output"])
                for step in steps
                if step.get("output")
            )
            return {
                "syntax_status": syntax_status,
                "test_status": syntax_status,
                "restart_status": restart_status,
                "deployed": deployed,
                "rolled_back": rolled_back,
                "rollback_status": rollback_status,
                "backup_path": backup_path if preserve_backup else None,
                "output": output,
                "steps": steps,
            }

        def rollback(*, restart_previous: bool) -> bool:
            nonlocal preserve_backup
            report("rollback", "Restaurando configuração anterior", "running")
            try:
                remote_path_quoted = shlex.quote(remote_path)
                backup_path_quoted = shlex.quote(backup_path)
                if had_previous_config:
                    restore_command = f"cp -a -- {backup_path_quoted} {remote_path_quoted}"
                else:
                    restore_command = f"rm -f -- {remote_path_quoted}"

                out, err, restore_code = self._run_sudo_command(client, restore_command)
                restore_output = self._combined_output(out, err)
                if restore_code != 0:
                    preserve_backup = had_previous_config
                    report("rollback", "Restaurando configuração anterior", "failed", restore_output)
                    return False

                rollback_test = self._run_nginx_test(client)
                rollback_outputs = [restore_output, str(rollback_test["output"])]
                rollback_passed = bool(rollback_test["test_status"])

                if rollback_passed and restart_previous:
                    out, err, restart_code = self._run_sudo_command(client, restart_command)
                    rollback_outputs.append(self._combined_output(out, err))
                    rollback_passed = restart_code == 0

                preserve_backup = had_previous_config and not rollback_passed
                report(
                    "rollback",
                    "Restaurando configuração anterior",
                    "passed" if rollback_passed else "failed",
                    "\n".join(output for output in rollback_outputs if output),
                )
                return rollback_passed
            except Exception as exc:
                preserve_backup = had_previous_config
                report("rollback", "Restaurando configuração anterior", "failed", str(exc))
                return False

        try:
            report("connect", "Conectando à VM", "running")
            try:
                client = self._connect()
            except Exception as exc:
                report("connect", "Conectando à VM", "failed", str(exc))
                return build_result(deployed=False)
            report("connect", "Conectando à VM", "passed", f"Conectado a {self.hostname}:{self.port}")

            report("upload", "Enviando configuração", "running")
            try:
                sftp = client.open_sftp()
                try:
                    with sftp.file(temp_path, "w") as remote_file:
                        remote_file.write(config_text)
                finally:
                    sftp.close()
            except Exception as exc:
                report("upload", "Enviando configuração", "failed", str(exc))
                return build_result(deployed=False)
            report("upload", "Enviando configuração", "passed", temp_path)

            report("backup", "Preservando versão atual", "running")
            remote_path_quoted = shlex.quote(remote_path)
            backup_path_quoted = shlex.quote(backup_path)
            backup_command = (
                f"if [ -e {remote_path_quoted} ]; then "
                f"cp -a -- {remote_path_quoted} {backup_path_quoted} && printf 'exists'; "
                "else printf 'missing'; fi"
            )
            out, err, backup_code = self._run_sudo_command(client, backup_command)
            backup_output = self._combined_output(out, err)
            if backup_code != 0:
                report("backup", "Preservando versão atual", "failed", backup_output)
                return build_result(deployed=False)
            had_previous_config = "exists" in out
            report(
                "backup",
                "Preservando versão atual",
                "passed",
                "Versão atual preservada." if had_previous_config else "Nenhum arquivo anterior encontrado.",
            )

            report("install", "Instalando arquivo candidato", "running")
            install_command = f"install -m 0644 -- {shlex.quote(temp_path)} {remote_path_quoted}"
            try:
                out, err, install_code = self._run_sudo_command(client, install_command)
            except Exception as exc:
                report("install", "Instalando arquivo candidato", "failed", str(exc))
                rollback_passed = rollback(restart_previous=False)
                return build_result(
                    deployed=False,
                    rolled_back=True,
                    rollback_status=rollback_passed,
                )
            install_output = self._combined_output(out, err)
            if install_code != 0:
                report("install", "Instalando arquivo candidato", "failed", install_output)
                return build_result(deployed=False)
            report("install", "Instalando arquivo candidato", "passed", remote_path)

            report("test", "Validando com nginx -t", "running")
            try:
                test_result = self._run_nginx_test(client)
            except Exception as exc:
                report("test", "Validando com nginx -t", "failed", str(exc))
                report("restart", "Recarregando NGINX", "skipped", "Teste não concluído.")
                rollback_passed = rollback(restart_previous=False)
                return build_result(
                    deployed=False,
                    rolled_back=True,
                    rollback_status=rollback_passed,
                )
            test_passed = bool(test_result["test_status"])
            report(
                "test",
                "Validando com nginx -t",
                "passed" if test_passed else "failed",
                str(test_result["output"]),
            )
            if not test_passed:
                report("restart", "Recarregando NGINX", "skipped", "Teste de configuração reprovado.")
                rollback_passed = rollback(restart_previous=False)
                return build_result(
                    deployed=False,
                    syntax_status=False,
                    rolled_back=True,
                    rollback_status=rollback_passed,
                )

            report("restart", "Recarregando NGINX", "running")
            try:
                out, err, restart_code = self._run_sudo_command(client, restart_command)
            except Exception as exc:
                out, err, restart_code = "", str(exc), 1
            restart_output = self._combined_output(out, err)
            if restart_code != 0:
                report("restart", "Recarregando NGINX", "failed", restart_output)
                rollback_passed = rollback(restart_previous=True)
                return build_result(
                    deployed=False,
                    syntax_status=True,
                    restart_status=False,
                    rolled_back=True,
                    rollback_status=rollback_passed,
                )

            report("restart", "Recarregando NGINX", "passed", restart_output or "NGINX recarregado.")
            report("rollback", "Restaurando configuração anterior", "skipped", "Publicação aprovada.")
            return build_result(deployed=True, syntax_status=True, restart_status=True)
        finally:
            if client:
                client.close()
