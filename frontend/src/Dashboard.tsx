import { useState, useEffect } from "react";
import { Search, Edit, ExternalLink, Globe } from "lucide-react";

import { useNavigate } from "react-router-dom";
import {
  getServices,
  updateService,
  addService,
  deleteService,
  getNginxConfig,
} from "./api/services";
import { logoutUser } from "./api/axios";
import { Navbar } from "./components/Navbar";
import UserManager from "./components/UserManager";
import ServiceModal from "./components/ServiceModal";
import NginxConfigModal from "./components/NginxConfigModal";

// Define interfaces for our data types
interface ServiceType {
  srv_id: number;
  srv_image: Base64URLString;
  srv_name: string;
  srv_ip: string;
  srv_desc: string;
  rt_location_path?: string;
  rt_proxy_pass?: string;
  rt_proxy_params?: string;
  rt_custom_params?: string;
  rt_backend_location_path?: string;
  rt_backend_proxy_pass?: string;
  rt_backend_proxy_params?: string;
  rt_backend_custom_params?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRemoveLoading, setRemoveIsLoading] = useState<boolean>(false);
  const [services, setServices] = useState<ServiceType[]>([]);

  // Unified modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [userManager, setUserManager] = useState<boolean>(false);
  const [nginxConfigModal, setNginxConfigModal] = useState<boolean>(false);
  const [nginxConfig, setNginxConfig] = useState<string | null>(null);
  const [isNginxLoading, setIsNginxLoading] = useState<boolean>(false);

  const [currentService, setCurrentService] = useState<
    ServiceType | Omit<ServiceType, "srv_id">
  >({
    srv_image: "/api/placeholder/200/150",
    srv_name: "",
    srv_ip: "",
    srv_desc: "",
    rt_location_path: "",
    rt_proxy_pass: "",
    rt_proxy_params: "",
    rt_custom_params: "",
    rt_backend_location_path: "",
    rt_backend_proxy_pass: "",
    rt_backend_proxy_params: "",
    rt_backend_custom_params: "",
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showInfoPopup, setShowInfoPopup] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredServices = services.filter(
    (service) =>
      service.srv_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.srv_ip.includes(searchTerm),
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
    e.stopPropagation();
    setCurrentService(service);
    setIsEditMode(true);
    setModalOpen(true);
  };

  // Function to handle add service modal open
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setCurrentService({
      srv_image: "/api/placeholder/200/150",
      srv_name: "",
      srv_ip: "",
      srv_desc: "",
      rt_location_path: "",
      rt_proxy_pass: "",
      rt_proxy_params: "",
      rt_custom_params: "",
      rt_backend_location_path: "",
      rt_backend_proxy_pass: "",
      rt_backend_proxy_params: "",
      rt_backend_custom_params: "",
    });
    setPreviewImage(null);
    setSelectedFile(null);
    setModalOpen(true);
  };

  // Function to handle modal close
  const handleCloseModal = () => {
    setModalOpen(false);
    setPreviewImage(null);
    setSelectedFile(null);
  };

  // Function to handle service update
  const handleUpdateService = async (): Promise<void> => {
    try {
      if (!("srv_id" in currentService)) return;
      setIsLoading(true);

      const formData = new FormData();
      formData.append("srv_name", currentService.srv_name);
      formData.append("srv_ip", currentService.srv_ip);
      formData.append("srv_desc", currentService.srv_desc);
      formData.append(
        "rt_location_path",
        currentService.rt_location_path ?? "",
      );
      formData.append("rt_proxy_pass", currentService.rt_proxy_pass ?? "");
      formData.append("rt_proxy_params", currentService.rt_proxy_params ?? "");
      formData.append(
        "rt_custom_params",
        currentService.rt_custom_params ?? "",
      );
      formData.append(
        "api_rt_location_path",
        currentService.rt_backend_location_path ?? "",
      );
      formData.append(
        "api_rt_proxy_pass",
        currentService.rt_backend_proxy_pass ?? "",
      );
      formData.append(
        "api_rt_proxy_params",
        currentService.rt_backend_proxy_params ?? "",
      );
      formData.append(
        "api_rt_custom_params",
        currentService.rt_backend_custom_params ?? "",
      );
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }
      await updateService(currentService.srv_id, formData);

      // Update the services in state
      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      handleCloseModal();
    } catch (err) {
      console.error("Error updating service:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (): Promise<void> => {
    try {
      if (!("srv_id" in currentService)) return;
      setRemoveIsLoading(true);

      await deleteService(currentService.srv_id);

      // Update the services in state
      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      handleCloseModal();
    } catch (err) {
      console.error("Error deleting service:", err);
    } finally {
      setRemoveIsLoading(false);
    }
  };

  // Function to handle add service
  const handleAddService = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("srv_name", currentService.srv_name);
      formData.append("srv_ip", currentService.srv_ip);
      formData.append("srv_desc", currentService.srv_desc);
      formData.append(
        "rt_location_path",
        currentService.rt_location_path ?? "",
      );
      formData.append("rt_proxy_pass", currentService.rt_proxy_pass ?? "");
      formData.append("rt_proxy_params", currentService.rt_proxy_params ?? "");
      formData.append(
        "rt_custom_params",
        currentService.rt_custom_params ?? "",
      );
      formData.append(
        "api_rt_location_path",
        currentService.rt_backend_location_path ?? "",
      );
      formData.append(
        "api_rt_proxy_pass",
        currentService.rt_backend_proxy_pass ?? "",
      );
      formData.append(
        "api_rt_proxy_params",
        currentService.rt_backend_proxy_params ?? "",
      );
      formData.append(
        "api_rt_custom_params",
        currentService.rt_backend_custom_params ?? "",
      );
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }

      await addService(formData);

      const request = await getServices();
      setServices(request["content"] as ServiceType[]);

      handleCloseModal();
    } catch (err) {
      console.error("Error adding service:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
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

  const handleViewNginxConfig = async () => {
    try {
      setIsNginxLoading(true);
      const data = await getNginxConfig();
      setNginxConfig(data.config);
      setNginxConfigModal(true);
    } catch (error) {
      console.error("Error fetching nginx config:", error);
    } finally {
      setIsNginxLoading(false);
    }
  };

  const handleCloseNginxModal = () => {
    setNginxConfigModal(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#2e7675] overflow-hidden">
      {/* Header */}
      <Navbar
        handleLogout={handleLogout}
        setSearchTerm={setSearchTerm}
        searchTerm={searchTerm}
        isAdmin={isAdmin}
        onAddService={handleOpenAddModal}
        onManageUsers={() => setUserManager((prev) => !prev)}
        onViewNginxConfig={handleViewNginxConfig}
        isAddLoading={isLoading}
      />

      {/* Main content - Restored green border effect via margin and background */}
      <main className="flex-1 bg-gray-50 m-2 rounded-xl overflow-y-auto p-4 sm:p-6 shadow-2xl">
        <div className="w-full h-full">
          {showInfoPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8">
              <div className="bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.25)] max-w-md w-full p-8 text-center space-y-5 border border-[#2e7675]/20">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#2e7675]/15 text-[#2e7675] flex items-center justify-center text-2xl font-black">
                  !
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#2e7675]">
                    Informação
                  </p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  O endereço anterior{" "}
                  <strong className="text-gray-900">192.168.2.131</strong> foi
                  descontinuado para garantir mais estabilidade e segurança.
                  Acesse o painel usando{" "}
                  <strong className="text-[#2e7675]">
                    indicadores.samur.br
                  </strong>{" "}
                  .
                </p>
                <button
                  onClick={() => setShowInfoPopup(false)}
                  className="inline-flex justify-center py-3 px-5 text-sm font-semibold rounded-xl text-white bg-[#2e7675] hover:bg-[#256160] transition-colors shadow-md"
                >
                  Entendi, pode fechar
                </button>
              </div>
            </div>
          )}
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

      {/* Unified Modal */}
      <ServiceModal
        isOpen={modalOpen}
        isLoading={isLoading}
        isRemoveLoading={isRemoveLoading}
        isEdit={isEditMode}
        service={currentService}
        onServiceChange={setCurrentService}
        onSave={isEditMode ? handleUpdateService : handleAddService}
        onDelete={isEditMode ? handleDeleteService : undefined}
        onClose={handleCloseModal}
        previewImage={previewImage}
        onFileSelect={handleFileSelect}
      />

      {userManager && <UserManager onClose={handleCloseUserManager} />}

      <NginxConfigModal
        isOpen={nginxConfigModal}
        onClose={handleCloseNginxModal}
        config={nginxConfig}
        isLoading={isNginxLoading}
      />
    </div>
  );
}
