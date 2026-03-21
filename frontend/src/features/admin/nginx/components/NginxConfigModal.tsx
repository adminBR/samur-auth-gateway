import { useState } from "react";
import { X, Copy, Download, LoaderCircle, Upload, History } from "lucide-react";
import { deployNginxConfig, restoreNginxConfig } from "../../../../api/services";

interface NginxConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: string | null;
  isLoading: boolean;
}

export default function NginxConfigModal({
  isOpen,
  onClose,
  config,
  isLoading,
}: NginxConfigModalProps) {
  const [copied, setCopied] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    status: "passed" | "passed_with_warnings" | "failed";
    message: string;
    output?: string;
    warnings?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (config) {
      navigator.clipboard.writeText(config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (config) {
      const element = document.createElement("a");
      const file = new Blob([config], { type: "text/plain" });
      element.href = URL.createObjectURL(file);
      element.download = "nginx.conf";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const handleDeploy = async () => {
    if (!config) return;
    setIsDeploying(true);
    setDeployResult(null);
    try {
      const res = await deployNginxConfig(config);
      const statusLabel =
        (res?.status_label as "passed" | "passed_with_warnings" | "failed") ??
        ("failed" as const);
      setDeployResult({
        status: statusLabel,
        message:
          res?.message ??
          (statusLabel === "passed"
            ? "Configuração aplicada com sucesso."
            : statusLabel === "passed_with_warnings"
              ? "Config aplicada com avisos."
              : "Config aplicada, mas os testes falharam."),
        output: res?.deployment?.output,
        warnings: res?.deployment?.warnings ?? [],
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "Falha ao aplicar configuração.";
      setDeployResult({
        status: "failed",
        message,
        output: error?.response?.data?.deployment?.output,
        warnings: error?.response?.data?.deployment?.warnings ?? [],
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setDeployResult(null);
    try {
      const res = await restoreNginxConfig();
      const statusLabel =
        (res?.status_label as "passed" | "passed_with_warnings" | "failed") ?? "failed";
      setDeployResult({
        status: statusLabel,
        message:
          res?.message ??
          (statusLabel === "passed"
            ? "Configuração restaurada com sucesso."
            : "Falha ao restaurar configuração."),
        output: res?.deployment?.output,
        warnings: res?.deployment?.warnings ?? [],
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "Falha ao restaurar configuração.";
      setDeployResult({
        status: "failed",
        message,
        output: error?.response?.data?.deployment?.output,
        warnings: error?.response?.data?.deployment?.warnings ?? [],
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Configuração NGINX
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <LoaderCircle className="w-10 h-10 animate-spin text-[#2e7675] mb-3" />
              <p className="text-gray-500">Gerando configuração...</p>
            </div>
          ) : config ? (
            <>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                {config}
              </pre>
              {deployResult && (
                <div
                  className={`mt-4 rounded-lg p-3 text-sm ${
                    deployResult.status === "passed"
                      ? "bg-green-50 text-green-800"
                      : deployResult.status === "passed_with_warnings"
                        ? "bg-yellow-50 text-yellow-800"
                        : "bg-red-50 text-red-800"
                  }`}
                >
                  <p className="font-semibold">
                    {deployResult.status === "passed"
                      ? "Teste aprovado"
                      : deployResult.status === "passed_with_warnings"
                        ? "Teste aprovado com avisos"
                        : "Teste reprovado"}
                  </p>
                  <p className="mt-1">{deployResult.message}</p>
                  {!!deployResult.warnings?.length && (
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
                      {deployResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {deployResult.output && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/70 p-2 text-xs text-white/80">
                      {deployResult.output}
                    </pre>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">Nenhuma configuração disponível</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-t border-gray-100 bg-white">
          {deployResult && (
            <div
              className={`text-sm font-semibold ${
                deployResult.status === "passed"
                  ? "text-green-700"
                  : deployResult.status === "passed_with_warnings"
                    ? "text-yellow-700"
                    : "text-red-700"
              }`}
            >
              <span>
                {deployResult.status === "passed"
                  ? "Configuração publicada com sucesso."
                  : deployResult.status === "passed_with_warnings"
                    ? "Publicada com avisos."
                    : "Falha ao publicar configuração."}
              </span>
              <span className="block text-xs font-normal mt-1 text-gray-500">
                {deployResult.message}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleDeploy}
              disabled={!config || isDeploying}
              className="inline-flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#256160] enabled:hover:bg-[#1f4d4c] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              {isDeploying ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isDeploying ? "Publicando..." : "Publicar config"}
            </button>
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="inline-flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#1f4d4c] enabled:hover:bg-[#183b3a] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              {isRestoring ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <History className="h-4 w-4" />
              )}
              {isRestoring ? "Restaurando..." : "Restore"}
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
