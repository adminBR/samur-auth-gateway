import { useEffect, useRef, useState } from "react";
import {
  X,
  LoaderCircle,
  CheckCircle,
  XCircle,
  PanelTop,
  ChevronDown,
  LayoutTemplate,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { IndicatorCategoryOption } from "../../../indicators/config/serviceCategories";
import type { EditableIndicatorService } from "../../../indicators/types/indicatorService";

interface ServiceModalProps {
  isOpen: boolean;
  isLoading: boolean;
  isRemoveLoading?: boolean;
  isEdit: boolean;
  categories: IndicatorCategoryOption[];
  service: EditableIndicatorService;
  onServiceChange: (service: EditableIndicatorService) => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  previewImage: string | null;
  onFileSelect: (file: File) => void;
  predictedServiceId?: number | null;
}

interface TemplateOption {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  block: string;
}

function TemplateMenu({
  templates,
  title,
  onSelect,
}: {
  templates: TemplateOption[];
  title: string;
  onSelect: (block: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="absolute bottom-3 right-3">
      <button
        type="button"
        onClick={() => setIsOpen((menuIsOpen) => !menuIsOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#cfe2dc] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#2e7675] shadow-sm transition-colors hover:bg-[#f4faf7] focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:ring-offset-2"
        title={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        <span>Templates</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-20 mb-2 w-60 overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl"
        >
          {templates.map((template) => {
            const TemplateIcon = template.icon;

            return (
              <button
                key={template.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(template.block);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[#f4faf7] focus:bg-[#f4faf7] focus:outline-none"
              >
                <TemplateIcon className="h-4 w-4 shrink-0 text-[#2e7675]" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-gray-800">
                    {template.label}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    {template.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const buildFrontendReferenceBlock = (
  serviceId: number | string,
) => `location /novo_caminho/ {
        set $service_id ${serviceId};
        # We redirect pages directly to login
        error_page 401 = @api_err401; 
        error_page 403 = @api_err403;

        proxy_pass http://server_address:8000/;
        proxy_http_version 1.1;
    }`;

const buildBackendReferenceBlock = (
  serviceId: number | string,
) => `location /novo_caminho_API/ {
        set $service_id ${serviceId};
        # We return JSON 401 for APIs so frontend fetch requests don't fail parsing HTML
        error_page 401 = @api_err401; 
        error_page 403 = @api_err403;

        proxy_pass http://server_address:8001/;
        proxy_http_version 1.1;
    }`;

const normalizeLocationPath = (path: string) => {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return "/novo_caminho/";
  }

  const withLeadingSlash = trimmedPath.startsWith("/")
    ? trimmedPath
    : `/${trimmedPath}`;

  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
};

const slugifyLocationName = (value: string) => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalizeLocationPath(slug);
};

const getLocationPathFromBlock = (block?: string | null) => {
  const match = block?.match(/location\s+([^\s{]+)\s*\{/);
  return match?.[1] ? normalizeLocationPath(match[1]) : null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeSingleQuotedNginxValue = (value: string) =>
  escapeHtml(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const buildIframeFrontendBlock = ({
  serviceId,
  serviceName,
  iframeSrc,
  locationPath,
}: {
  serviceId: number | string;
  serviceName: string;
  iframeSrc: string;
  locationPath: string;
}) => {
  const title = escapeSingleQuotedNginxValue(serviceName.trim() || "Indicador");
  const src = escapeSingleQuotedNginxValue(iframeSrc.trim() || "https://app.powerbi.com/view?r=");

  return `location ${locationPath} {
    set $service_id ${serviceId};

    error_page 401 = @api_err401;
    error_page 403 = @api_err403;

    default_type text/html;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;

    return 200 '<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    iframe {
      border: 0;
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <iframe
    src="${src}"
    allowfullscreen="true">
  </iframe>
</body>
</html>';
}`;
};

export default function ServiceModal({
  isOpen,
  isLoading,
  isRemoveLoading = false,
  isEdit,
  categories,
  service,
  onServiceChange,
  onSave,
  onDelete,
  onClose,
  previewImage,
  onFileSelect,
  predictedServiceId = null,
}: ServiceModalProps) {
  const title = isEdit
    ? `Editar Indicador - ID ${service.srv_id ?? "-"}`
    : "Adicionar Novo Indicador";
  const buttonText = isEdit ? "Salvar" : "Adicionar";
  const resolvedServiceId = isEdit
    ? (service.srv_id ?? null)
    : predictedServiceId;
  const expectedServiceIdLine =
    resolvedServiceId !== null ? `set $service_id ${resolvedServiceId};` : null;
  const normalizedTarget = service.srv_ip.trim();
  const isExternalUrl = /^https?:\/\//i.test(normalizedTarget);
  const firstSlashIndex = normalizedTarget.indexOf("/");
  const rawPath =
    !isExternalUrl && firstSlashIndex >= 0
      ? normalizedTarget.slice(firstSlashIndex).trim()
      : "";
  const expectedFrontendLocation = rawPath
    ? `location ${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`
    : null;
  const serviceIdReference = resolvedServiceId ?? "{proximo_id}";
  const frontendReference = buildFrontendReferenceBlock(serviceIdReference);
  const backendReference = buildBackendReferenceBlock(serviceIdReference);
  const iframeLocationPath =
    getLocationPathFromBlock(service.rt_frontend_block) ||
    slugifyLocationName(service.srv_name);
  const isIframeFrontendBlock = Boolean(
    service.rt_frontend_block?.includes("return 200 '<!doctype html>") &&
      service.rt_frontend_block.includes("<iframe"),
  );
  const iframeFrontendReference = buildIframeFrontendBlock({
    serviceId: serviceIdReference,
    serviceName: service.srv_name,
    iframeSrc: service.srv_ip,
    locationPath: iframeLocationPath,
  });
  const frontendTemplates: TemplateOption[] = [
    {
      id: "normal",
      label: "Conexão normal",
      description: "Conexão via proxy.",
      icon: Server,
      block: frontendReference,
    },
    {
      id: "iframe",
      label: "Iframe",
      description: "Página HTML incorporada.",
      icon: PanelTop,
      block: iframeFrontendReference,
    },
  ];
  const backendTemplates: TemplateOption[] = [
    {
      id: "normal",
      label: "Conexão normal",
      description: "Conexão via proxy para API.",
      icon: Server,
      block: backendReference,
    },
  ];

  if (!isOpen) return null;

  const applyFrontendTemplate = (block: string) => {
    onServiceChange({
      ...service,
      rt_frontend_block: block,
    });
  };

  const applyBackendTemplate = (block: string) => {
    onServiceChange({
      ...service,
      rt_backend_block: block,
    });
  };

  const renderServiceIdValidation = (block?: string) => {
    if (!expectedServiceIdLine) {
      return (
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-[#2e7675]" />
          <span className="text-xs text-gray-600">
            Calculando proximo ID...
          </span>
        </div>
      );
    }

    const hasServiceIdLine = block?.includes(expectedServiceIdLine);

    return (
      <div className="flex items-center gap-2">
        {hasServiceIdLine ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-xs text-gray-600">
          {hasServiceIdLine
            ? `ID do Indicador (${resolvedServiceId})`
            : `Faltando linha: ${expectedServiceIdLine}`}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 sm:max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Ativo</span>
              <button
                type="button"
                onClick={() =>
                  onServiceChange({
                    ...service,
                    rt_enabled: !service.rt_enabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  service.rt_enabled ? "bg-[#2e7675]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    service.rt_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nome do Indicador
                </label>
                <input
                  type="text"
                  value={service.srv_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onServiceChange({
                      ...service,
                      srv_name: e.target.value,
                    })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                  placeholder="Insira um nome"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  value={
                    categories.length > 0 ? String(service.srv_category) : ""
                  }
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    onServiceChange({
                      ...service,
                      srv_category: Number(e.target.value),
                    })
                  }
                  disabled={categories.length === 0}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                >
                  {categories.length === 0 ? (
                    <option value="">Nenhuma categoria disponivel</option>
                  ) : (
                    categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Endereço de redirecionamento
                </label>
                <input
                  type="text"
                  value={service.srv_ip}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onServiceChange({
                      ...service,
                      srv_ip: e.target.value,
                    })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                  placeholder="Insira um endereco a ser redirecionado"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Descricao
                </label>
                <textarea
                  value={service.srv_desc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onServiceChange({
                      ...service,
                      srv_desc: e.target.value,
                    })
                  }
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                  placeholder="Insira uma descricao sobre o funcionamento do indicador"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Imagem do Indicador
                </label>
                <div className="relative mt-1 flex cursor-pointer justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 pb-6 pt-5 transition-colors hover:border-[#2e7675]">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onFileSelect(file);
                      }
                    }}
                  />
                  <div className="space-y-1 text-center">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="mx-auto h-32 rounded object-cover"
                      />
                    ) : (
                      <div className="text-gray-500">
                        <span className="font-medium text-[#2e7675]">
                          Enviar arquivo
                        </span>{" "}
                        ou arrastar para ca
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:col-span-3 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  Frontend (NGINX)
                </h4>
                <div className="relative">
                  <textarea
                    value={service.rt_frontend_block ?? ""}
                    onChange={(e) =>
                      onServiceChange({
                        ...service,
                        rt_frontend_block: e.target.value,
                      })
                    }
                    rows={15}
                    className="block w-full whitespace-pre rounded-lg border border-gray-300 px-3 py-2 pb-12 pr-32 font-mono shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                    placeholder="location / { ... }"
                  />
                  <TemplateMenu
                    templates={frontendTemplates}
                    title="Selecionar template do frontend"
                    onSelect={applyFrontendTemplate}
                  />
                </div>
                {renderServiceIdValidation(service.rt_frontend_block)}
                <div className="flex items-center gap-2">
                  {(isIframeFrontendBlock && getLocationPathFromBlock(service.rt_frontend_block)) ||
                  (expectedFrontendLocation &&
                    service.rt_frontend_block?.includes(
                      expectedFrontendLocation,
                    )) ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-gray-600">
                    {isIframeFrontendBlock &&
                    getLocationPathFromBlock(service.rt_frontend_block)
                      ? "Localização do iframe definida"
                      : expectedFrontendLocation &&
                          service.rt_frontend_block?.includes(
                            expectedFrontendLocation,
                          )
                        ? "Localização do frontend correspondente"
                        : `Faltando linha: ${expectedFrontendLocation ?? "location /caminho"}`}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  Backend (NGINX)
                </h4>
                <div className="relative">
                  <textarea
                    value={service.rt_backend_block ?? ""}
                    onChange={(e) =>
                      onServiceChange({
                        ...service,
                        rt_backend_block: e.target.value,
                      })
                    }
                    rows={15}
                    className="block w-full whitespace-pre rounded-lg border border-gray-300 px-3 py-2 pb-12 pr-32 font-mono shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                    placeholder="location /api { ... }"
                  />
                  <TemplateMenu
                    templates={backendTemplates}
                    title="Selecionar template do backend"
                    onSelect={applyBackendTemplate}
                  />
                </div>
                {renderServiceIdValidation(service.rt_backend_block)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-4 sm:px-6">
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex justify-center rounded-lg border border-transparent bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {isRemoveLoading ? (
                <LoaderCircle className="h-5 w-5 animate-spin text-white" />
              ) : (
                <p>Remover</p>
              )}
            </button>
          )}

          <div className="ml-auto flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="inline-flex justify-center rounded-lg border border-transparent bg-[#2e7675] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:ring-offset-2"
            >
              {isLoading ? (
                <LoaderCircle className="h-5 w-5 animate-spin text-white" />
              ) : (
                <p>{buttonText}</p>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
