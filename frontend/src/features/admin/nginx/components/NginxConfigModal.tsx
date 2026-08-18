import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  History,
  LoaderCircle,
  RotateCcw,
  Terminal,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  deployNginxConfigStream,
  restoreNginxConfigStream,
  type NginxDeploymentResult,
  type NginxProgressStep,
} from "../../../../api/services";

interface NginxConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: string | null;
  isLoading: boolean;
}

const INITIAL_STEPS: NginxProgressStep[] = [
  { id: "connect", label: "Conectando à VM", status: "pending" },
  { id: "upload", label: "Enviando configuração", status: "pending" },
  { id: "backup", label: "Preservando versão atual", status: "pending" },
  { id: "install", label: "Instalando arquivo candidato", status: "pending" },
  { id: "test", label: "Validando com nginx -t", status: "pending" },
  { id: "restart", label: "Reiniciando NGINX", status: "pending" },
  { id: "rollback", label: "Restauração automática", status: "pending" },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Falha inesperada na operação NGINX.";

export default function NginxConfigModal({
  isOpen,
  onClose,
  config,
  isLoading,
}: NginxConfigModalProps) {
  const [copied, setCopied] = useState(false);
  const [operation, setOperation] = useState<"publish" | "restore" | null>(null);
  const [steps, setSteps] = useState<NginxProgressStep[]>(INITIAL_STEPS);
  const [result, setResult] = useState<NginxDeploymentResult | null>(null);

  const isBusy = operation !== null;
  const lineCount = config?.split("\n").length ?? 0;
  const logOutput = useMemo(
    () =>
      steps
        .filter((step) => step.output)
        .map((step) => `[${step.label}]\n${step.output}`)
        .join("\n\n"),
    [steps],
  );

  if (!isOpen) return null;

  const updateStep = (nextStep: NginxProgressStep) => {
    setSteps((currentSteps) => {
      const exists = currentSteps.some((step) => step.id === nextStep.id);
      if (!exists) return [...currentSteps, nextStep];
      return currentSteps.map((step) =>
        step.id === nextStep.id ? nextStep : step,
      );
    });
  };

  const finishPendingSteps = () => {
    setSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.status === "pending" ? { ...step, status: "skipped" } : step,
      ),
    );
  };

  const handleCopy = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!config) return;
    const element = document.createElement("a");
    const fileUrl = URL.createObjectURL(
      new Blob([config], { type: "text/plain" }),
    );
    element.href = fileUrl;
    element.download = "api-gateway.conf";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(fileUrl);
  };

  const handleDeploy = async () => {
    if (!config || isBusy) return;
    setOperation("publish");
    setSteps(INITIAL_STEPS);
    setResult(null);
    try {
      const deploymentResult = await deployNginxConfigStream(config, updateStep);
      setResult(deploymentResult);
    } catch (error: unknown) {
      setResult({ status_label: "failed", message: getErrorMessage(error) });
    } finally {
      finishPendingSteps();
      setOperation(null);
    }
  };

  const handleRestore = async () => {
    if (isBusy) return;
    setOperation("restore");
    setSteps(INITIAL_STEPS);
    setResult(null);
    try {
      const restoreResult = await restoreNginxConfigStream(updateStep);
      setResult(restoreResult);
    } catch (error: unknown) {
      setResult({ status_label: "failed", message: getErrorMessage(error) });
    } finally {
      finishPendingSteps();
      setOperation(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-5">
      <div className="nginx-workspace flex w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-gray-200 px-4 sm:px-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">
              Publicação NGINX
            </h3>
            <p className="truncate text-xs text-gray-500">
              {result?.remote_path ?? "/etc/nginx/sites-available/api-gateway.conf"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!config}
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40"
              title={copied ? "Configuração copiada" : "Copiar configuração"}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!config}
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40"
              title="Baixar api-gateway.conf"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-gray-50">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#2e7675]" />
            <p className="text-sm text-gray-500">Gerando configuração...</p>
          </div>
        ) : config ? (
          <main className="nginx-workspace-grid min-h-0 flex-1 bg-white">
            <section className="nginx-workspace-pane flex min-w-0 flex-col border-gray-200">
              <div className="flex min-h-11 items-center justify-between border-b border-gray-200 px-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Terminal className="h-4 w-4 text-[#2e7675]" />
                  Configuração gerada
                </div>
                <span className="text-xs tabular-nums text-gray-500">
                  {lineCount} linhas
                </span>
              </div>
              <pre className="nginx-config-code min-h-0 flex-1 overflow-auto p-4 font-mono">
                {config}
              </pre>
            </section>

            <aside className="nginx-workspace-pane nginx-side-panel flex min-w-0 flex-col">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Progresso</h4>
                  {isBusy && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2e7675]">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      {operation === "restore" ? "Restaurando" : "Publicando"}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex min-h-8 items-center gap-2.5 px-1 text-xs"
                    >
                      {step.status === "running" ? (
                        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#2e7675]" />
                      ) : step.status === "passed" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : step.status === "failed" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                      ) : step.status === "skipped" ? (
                        <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-gray-400" />
                      )}
                      <span
                        className={
                          step.status === "skipped"
                            ? "text-gray-400"
                            : "font-medium text-gray-700"
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-10 items-center justify-between border-b border-gray-200 px-4">
                  <h4 className="text-xs font-semibold uppercase text-gray-600">Saída</h4>
                  {result?.conf_id && (
                    <span className="text-[11px] tabular-nums text-gray-500">
                      Registro #{result.conf_id}
                    </span>
                  )}
                </div>
                <pre className="nginx-output-code flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono">
                  {logOutput || "Aguardando uma operação..."}
                </pre>
              </div>

              {result && (
                <div
                  className={`border-t px-4 py-3 text-sm ${
                    result.status_label === "passed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.status_label === "passed" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {result.status_label === "passed"
                          ? "Operação concluída"
                          : "Operação não concluída"}
                      </p>
                      <p className="mt-0.5 text-xs">{result.message}</p>
                      {result.deployment?.backup_path && (
                        <p className="mt-1 break-all font-mono text-[10px]">
                          Backup preservado: {result.deployment.backup_path}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </main>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-50 text-sm text-gray-500">
            Nenhuma configuração disponível.
          </div>
        )}

        <footer className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 sm:px-5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <History className="h-4 w-4" />
            A última versão aprovada permanece disponível para restauração.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestore}
              disabled={isBusy}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {operation === "restore" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restaurar última versão
            </button>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={!config || isBusy}
              className="nginx-publish-button inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {operation === "publish" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Publicar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
