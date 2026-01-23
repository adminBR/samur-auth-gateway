import { useState } from "react";
import { X, Copy, Download, LoaderCircle } from "lucide-react";

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
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
              {config}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">Nenhuma configuração disponível</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white">
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
  );
}
