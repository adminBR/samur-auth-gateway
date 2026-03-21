import { useState } from "react";
import { X, LoaderCircle, CheckCircle, XCircle } from "lucide-react";
import { indicatorCategories } from "../constants/serviceCategories";
import type { EditableIndicatorService } from "../types/indicatorService";

interface ServiceModalProps {
  isOpen: boolean;
  isLoading: boolean;
  isRemoveLoading?: boolean;
  isEdit: boolean;
  service: EditableIndicatorService;
  onServiceChange: (service: EditableIndicatorService) => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  previewImage: string | null;
  onFileSelect: (file: File) => void;
}

export default function ServiceModal({
  isOpen,
  isLoading,
  isRemoveLoading = false,
  isEdit,
  service,
  onServiceChange,
  onSave,
  onDelete,
  onClose,
  previewImage,
  onFileSelect,
}: ServiceModalProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(
    isEdit && Boolean(service.rt_frontend_block || service.rt_backend_block),
  );

  if (!isOpen) return null;

  const title = isEdit ? "Editar Indicador" : "Adicionar Novo Indicador";
  const buttonText = isEdit ? "Salvar" : "Adicionar";

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${
          isAdvancedOpen ? "max-w-7xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">NGINX</span>
              <button
                type="button"
                onClick={() => setIsAdvancedOpen((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAdvancedOpen ? "bg-[#2e7675]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAdvancedOpen ? "translate-x-6" : "translate-x-1"
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

        <div className="space-y-6 p-6">
          <div
            className={`grid gap-6 ${
              isAdvancedOpen ? "grid-cols-1 lg:grid-cols-4" : ""
            }`}
          >
            <div
              className={`${isAdvancedOpen ? "lg:col-span-1" : ""} space-y-4`}
            >
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
                  value={service.srv_category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    onServiceChange({
                      ...service,
                      srv_category: e.target.value as EditableIndicatorService["srv_category"],
                    })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                >
                  {indicatorCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Endereco IP
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
                  placeholder="Insira um endereco ip (ex. 192.168.1.100)"
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

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Ativo</span>
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
            </div>

            {isAdvancedOpen && (
              <div className="grid grid-cols-1 gap-6 lg:col-span-3 lg:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Frontend (NGINX)
                  </h4>
                  <textarea
                    value={service.rt_frontend_block ?? ""}
                    onChange={(e) =>
                      onServiceChange({
                        ...service,
                        rt_frontend_block: e.target.value,
                      })
                    }
                    rows={15}
                    className="block w-full whitespace-pre rounded-lg border border-gray-300 px-3 py-2 font-mono shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                    placeholder="location / { ... }"
                  />
                  <div className="flex items-center gap-2">
                    {service.rt_frontend_block?.includes(
                      `set $service_id ${service.srv_id};`,
                    ) ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">
                      {service.rt_frontend_block?.includes(
                        `set $service_id ${service.srv_id};`,
                      )
                        ? `ID do Indicador (${service.srv_id})`
                        : `Faltando linha: set $service_id ${service.srv_id};`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.rt_frontend_block?.includes(
                      "auth_request /_auth;",
                    ) ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">
                      {service.rt_frontend_block?.includes(
                        "auth_request /_auth;",
                      )
                        ? "Solicitacao de autenticacao"
                        : "Faltando linha: auth_request /_auth;"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cleanedIp = service.srv_ip.replace(
                        "indicadores.samur.br",
                        "",
                      );
                      const path = cleanedIp.startsWith("/")
                        ? cleanedIp
                        : "/" + cleanedIp;
                      return service.rt_frontend_block?.includes(
                        `location ${path}`,
                      ) ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      );
                    })()}
                    <span className="text-xs text-gray-600">
                      {(() => {
                        const cleanedIp = service.srv_ip.replace(
                          "indicadores.samur.br",
                          "",
                        );
                        const path = cleanedIp.startsWith("/")
                          ? cleanedIp
                          : "/" + cleanedIp;
                        return service.rt_frontend_block?.includes(
                          `location ${path}`,
                        )
                          ? "Localizacao do frontend correspondente"
                          : `Faltando linha: location ${path}`;
                      })()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Backend (NGINX)
                  </h4>
                  <textarea
                    value={service.rt_backend_block ?? ""}
                    onChange={(e) =>
                      onServiceChange({
                        ...service,
                        rt_backend_block: e.target.value,
                      })
                    }
                    rows={15}
                    className="block w-full whitespace-pre rounded-lg border border-gray-300 px-3 py-2 font-mono shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2e7675] sm:text-sm"
                    placeholder="location /api { ... }"
                  />
                  <div className="flex items-center gap-2">
                    {service.rt_backend_block?.includes(
                      `set $service_id ${service.srv_id};`,
                    ) ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">
                      {service.rt_backend_block?.includes(
                        `set $service_id ${service.srv_id};`,
                      )
                        ? `ID do Indicador (${service.srv_id})`
                        : `Faltando linha: set $service_id ${service.srv_id};`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.rt_backend_block?.includes(
                      "auth_request /_auth;",
                    ) ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">
                      {service.rt_backend_block?.includes(
                        "auth_request /_auth;",
                      )
                        ? "Solicitacao de autenticacao"
                        : "Faltando linha: auth_request /_auth;"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 pb-6">
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
