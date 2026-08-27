from django.test import SimpleTestCase

from .managers import SshManager


class FakeRemoteFile:
    def __init__(self):
        self.content = ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def write(self, content):
        self.content = content


class FakeSftp:
    def __init__(self):
        self.remote_file = FakeRemoteFile()

    def file(self, path, mode):
        return self.remote_file

    def close(self):
        return None


class FakeSshClient:
    def __init__(self):
        self.sftp = FakeSftp()
        self.closed = False

    def open_sftp(self):
        return self.sftp

    def close(self):
        self.closed = True


class ScriptedSshManager(SshManager):
    def __init__(self, test_results, restart_codes):
        super().__init__(hostname="gateway-vm", username="deployer", password="secret")
        self.client = FakeSshClient()
        self.test_results = list(test_results)
        self.restart_codes = list(restart_codes)
        self.sudo_commands = []

    def _connect(self):
        return self.client

    def _run_command(self, client, command, stdin_text=None):
        return "", "", 0

    def _run_sudo_command(self, client, command):
        self.sudo_commands.append(command)
        if command.startswith("if [ -e"):
            return "exists", "", 0
        if command == "systemctl reload nginx":
            exit_code = self.restart_codes.pop(0)
            return "", "restart failed" if exit_code else "", exit_code
        return "", "", 0

    def _run_nginx_test(self, client):
        passed = self.test_results.pop(0)
        return {
            "syntax_status": passed,
            "test_status": passed,
            "exit_code": 0 if passed else 1,
            "output": "nginx test passed" if passed else "nginx test failed",
        }


class SshManagerDeploymentTests(SimpleTestCase):
    remote_path = "/etc/nginx/sites-available/api-gateway.conf"

    def test_successful_deployment_tests_and_reloads_nginx(self):
        manager = ScriptedSshManager(test_results=[True], restart_codes=[0])

        result = manager.deploy_nginx_config("server {}", self.remote_path)

        self.assertTrue(result["deployed"])
        self.assertTrue(result["test_status"])
        self.assertTrue(result["restart_status"])
        self.assertFalse(result["rolled_back"])
        self.assertIn("systemctl reload nginx", manager.sudo_commands)
        self.assertEqual(manager.client.sftp.remote_file.content, "server {}")

    def test_failed_nginx_test_restores_previous_file_without_restart(self):
        manager = ScriptedSshManager(test_results=[False, True], restart_codes=[])

        result = manager.deploy_nginx_config("invalid", self.remote_path)

        self.assertFalse(result["deployed"])
        self.assertTrue(result["rolled_back"])
        self.assertTrue(result["rollback_status"])
        self.assertNotIn("systemctl reload nginx", manager.sudo_commands)
        self.assertTrue(
            any(command.startswith("cp -a --") for command in manager.sudo_commands)
        )

    def test_failed_reload_restores_and_reloads_previous_config(self):
        manager = ScriptedSshManager(
            test_results=[True, True],
            restart_codes=[1, 0],
        )

        result = manager.deploy_nginx_config("server {}", self.remote_path)

        self.assertFalse(result["deployed"])
        self.assertTrue(result["test_status"])
        self.assertFalse(result["restart_status"])
        self.assertTrue(result["rolled_back"])
        self.assertTrue(result["rollback_status"])
        self.assertEqual(
            manager.sudo_commands.count("systemctl reload nginx"),
            2,
        )
