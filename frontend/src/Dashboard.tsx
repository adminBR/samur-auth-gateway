import { useState, useEffect } from "react";
import {
  Search,
  Edit,
  X,
  LoaderCircle,
  ExternalLink,
  Globe,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import {
  getServices,
  updateService,
  addService,
  deleteService,
} from "./api/services";
import { logoutUser } from "./api/axios";
import { Navbar } from "./components/Navbar";
import UserManager from "./components/UserManager";

// Define interfaces for our data types
interface ServiceType {
  srv_id: number;
  srv_image: Base64URLString;
  srv_name: string;
  srv_ip: string;
  srv_desc: string;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isRemoveLoading, setRemoveIsLoading] = useState<boolean>(false);
  // Sample data for the service cards
  const [services, setServices] = useState<ServiceType[]>([]);

  // State for managing edit modal
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [currentService, setCurrentService] = useState<ServiceType | null>(
    null
  );

  // State for managing add modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [userManager, setUserManager] = useState<boolean>(false);
  const [newService, setNewService] = useState<Omit<ServiceType, "srv_id">>({
    srv_image: "/api/placeholder/200/150",
    srv_name: "",
    srv_ip: "",
    srv_desc: "",
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Search functionality
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredServices = services.filter(
    (service) =>
      service.srv_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.srv_ip.includes(searchTerm)
  );

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleLogout = async () => {
    try {
      await logoutUser();
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/login");
    } catch (error) {
      console.log(error);
    }
  };

  // Function to handle service card click
  const handleServiceClick = (ip: string): void => {
    // Open the service in a new tab
    window.open(`http://${ip}`, "_blank");
  };

  // Function to handle edit button click
  const handleEditClick = (e: React.MouseEvent, service: ServiceType): void => {
    e.stopPropagation(); // Prevent the card click event from firing
    setCurrentService(service);
    setEditModalOpen(true);
  };

  // Function to handle service update
  const handleUpdateService = async (): Promise<void> => {
    try {
      if (!currentService) return;
      setIsLoading(true);

      const formData = new FormData();
      formData.append("srv_name", currentService.srv_name);
      formData.append("srv_ip", currentService.srv_ip);
      formData.append("srv_desc", currentService.srv_desc);
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }
      await updateService(currentService.srv_id, formData);

      // Update the services in state
      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      setEditModalOpen(false);
      setPreviewImage(null);
      setSelectedFile(null);
    } catch (err) {
      console.error("Error updating service:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (): Promise<void> => {
    try {
      if (!currentService) return;
      setRemoveIsLoading(true);

      await deleteService(currentService.srv_id);

      // Update the services in state
      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      setEditModalOpen(false);
      setPreviewImage(null);
      setSelectedFile(null);
    } catch (err) {
      console.error("Error updating service:", err);
    } finally {
      setRemoveIsLoading(false);
    }
  };

  // Function to handle add service
  const handleAddService = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("srv_name", newService.srv_name);
      formData.append("srv_ip", newService.srv_ip);
      formData.append("srv_desc", newService.srv_desc);
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }

      await addService(formData);

      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      setAddModalOpen(false);
      setPreviewImage(null);
      setSelectedFile(null);
    } catch (err) {
      console.error("Error adding service:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const populateServices = async (): Promise<void> => {
      try {
        const request = await getServices();
        setServices(request["content"] as ServiceType[]);
      } catch (err: unknown) {
        console.log("CallError", err);
      }
      setIsAdmin(localStorage.getItem("isAdmin") === "true" ? true : false);
    };
    populateServices();
  }, []); // Added dependency array to prevent infinite re-renders

  const handleCloseUserManager = () => {
    setUserManager(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#2e7675] overflow-hidden">
      {/* Header */}
      <Navbar
        handleLogout={handleLogout}
        setSearchTerm={setSearchTerm}
        searchTerm={searchTerm}
        isAdmin={isAdmin}
        onAddService={() => {
          setAddModalOpen(true);
          setNewService({
            srv_image: "/api/placeholder/200/150",
            srv_name: "",
            srv_ip: "",
            srv_desc: "",
          });
        }}
        onManageUsers={() => setUserManager((prev) => !prev)}
        isAddLoading={isLoading}
      />

      {/* Main content - Restored green border effect via margin and background */}
      <main className="flex-1 bg-gray-50 m-2 rounded-xl overflow-y-auto p-4 sm:p-6 shadow-2xl">
        <div className="w-full h-full">
          <div className="flex items-center gap-2 mb-4 bg-yellow-100/90 text-yellow-900 px-3 py-2 rounded-md text-xs sm:text-sm shadow-sm">
            <span className="font-semibold uppercase tracking-wide">
              Aviso:
            </span>
            <span className="leading-snug">
              Se estiver tendo problemas para acessar as dashboards, Saia da
              conta e entre novamente.
            </span>
          </div>
          <div className="min-h-[300px]">
            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {filteredServices.map((service) => (
                  <div
                    key={service.srv_ip}
                    onClick={() => handleServiceClick(service.srv_ip)}
                    className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden cursor-pointer flex flex-col h-full hover:-translate-y-1"
                  >
                    <div className="relative h-40 overflow-hidden bg-gray-200">
                      <img
                        src={`data:${service.srv_image
                          .split(".")
                          .pop()
                          ?.toLowerCase()};base64,${service.srv_image}`}
                        alt={service.srv_name}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-[#2e7675]/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <span className="text-white font-semibold flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/40 hover:bg-white/30 transition-colors text-sm">
                          Acessar <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => handleEditClick(e, service)}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-[#2e7675] shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                          title="Editar serviço"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-base font-bold text-gray-800 line-clamp-1 group-hover:text-[#2e7675] transition-colors">
                          {service.srv_name}
                        </h3>
                      </div>
                      <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-grow">
                        {service.srv_desc || "Sem descrição disponível."}
                      </p>
                      <div className="pt-3 border-t border-gray-100 flex items-center text-[10px] font-medium text-gray-500 mt-auto">
                        <Globe className="w-3 h-3 mr-1 text-[#2e7675]" />
                        <span className="bg-[#2e7675]/10 text-[#2e7675] px-1.5 py-0.5 rounded font-semibold">
                          {service.srv_ip}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Nenhum serviço encontrado
                </h3>
                <p className="mt-1 text-gray-500 max-w-sm">
                  Não encontramos serviços com o termo pesquisado.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editModalOpen && currentService && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar Serviço
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Serviço
                  </label>
                  <input
                    type="text"
                    value={currentService.srv_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCurrentService({
                        ...currentService,
                        srv_name: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço IP
                  </label>
                  <input
                    type="text"
                    value={currentService.srv_ip}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCurrentService({
                        ...currentService,
                        srv_ip: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={currentService.srv_desc}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setCurrentService({
                        ...currentService,
                        srv_desc: e.target.value,
                      })
                    }
                    rows={3}
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
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
                          setSelectedFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPreviewImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
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
              </div>

              <div className="mt-8 flex justify-between items-center">
                <div className="flex">
                  <button
                    onClick={handleDeleteService}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    {isRemoveLoading ? (
                      <LoaderCircle className="animate-spin w-5 h-5 text-white" />
                    ) : (
                      <p>Remover</p>
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditModalOpen(false)}
                    className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateService}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
                  >
                    {isLoading ? (
                      <LoaderCircle className="animate-spin w-5 h-5 text-white" />
                    ) : (
                      <p>Salvar</p>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {userManager && <UserManager onClose={handleCloseUserManager} />}

      {/* Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Adicionar Novo Serviço
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do serviço
                  </label>
                  <input
                    type="text"
                    value={newService.srv_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewService({ ...newService, srv_name: e.target.value })
                    }
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                    placeholder="Insira um nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ip do serviço
                  </label>
                  <input
                    type="text"
                    value={newService.srv_ip}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewService({ ...newService, srv_ip: e.target.value })
                    }
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                    placeholder="Insira um endereço ip (ex. 192.168.1.100)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do serviço
                  </label>
                  <textarea
                    value={newService.srv_desc}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewService({ ...newService, srv_desc: e.target.value })
                    }
                    rows={3}
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
                    placeholder="Insira uma descrição sobre o funcionamento do serviço"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagem do serviço
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-[#2e7675] transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPreviewImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
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
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddService}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
                >
                  {isLoading ? (
                    <LoaderCircle className="animate-spin w-5 h-5 text-white" />
                  ) : (
                    <p>Adicionar</p>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
