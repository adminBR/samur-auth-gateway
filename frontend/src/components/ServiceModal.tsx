import { useState } from "react";
import { X, LoaderCircle, CheckCircle, XCircle } from "lucide-react";

interface ServiceType {
  srv_id: number;
  srv_image: Base64URLString;
  srv_name: string;
  srv_ip: string;
  srv_desc: string;
  rt_frontend_block?: string;
  rt_backend_block?: string;
  rt_enabled?: boolean;
}

type EditableService = Omit<ServiceType, "srv_id"> & { srv_id?: number };

interface ServiceModalProps {
  isOpen: boolean;
  isLoading: boolean;
  isRemoveLoading?: boolean;
  isEdit: boolean;
  service: EditableService;
  onServiceChange: (service: EditableService) => void;
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

  const title = isEdit ? "Editar Serviço" : "Adicionar Novo Serviço";
  const buttonText = isEdit ? "Salvar" : "Adicionar";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center p-4">
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden transition-all duration-300 ${
          isAdvancedOpen ? "max-w-7xl" : "max-w-md"
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
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
              className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div
            className={`grid gap-6 ${
              isAdvancedOpen ? "grid-cols-1 lg:grid-cols-4" : ""
            }`}
          >
            <div
              className={`${isAdvancedOpen ? "lg:col-span-1" : ""} space-y-4`}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Serviço
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
                  className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                  placeholder="Insira um nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço IP
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
                  className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                  placeholder="Insira um endereço ip (ex. 192.168.1.100)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
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
                  className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                  placeholder="Insira uma descrição sobre o funcionamento do serviço"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imagem do Serviço
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-[#2e7675] transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
                        className="mx-auto h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="text-gray-500">
                        <span className="text-[#2e7675] font-medium">
                          Upload a file
                        </span>{" "}
                        or drag and drop
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Enabled
                </span>
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
              <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow font-mono whitespace-pre"
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
                        ? `ID do Serviço (${service.srv_id})`
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
                        ? "Solicitação de Autenticação"
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
                          ? "Localização do Frontend Correspondente"
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
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow font-mono whitespace-pre"
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
                        ? `ID do Serviço (${service.srv_id})`
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
                        ? "Solicitação de Autenticação"
                        : "Faltando linha: auth_request /_auth;"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-between items-center">
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              {isRemoveLoading ? (
                <LoaderCircle className="animate-spin w-5 h-5 text-white" />
              ) : (
                <p>Remover</p>
              )}
            </button>
          )}

          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
            >
              {isLoading ? (
                <LoaderCircle className="animate-spin w-5 h-5 text-white" />
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
