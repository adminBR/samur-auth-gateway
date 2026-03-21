import { useEffect, useRef, useState } from "react";
import { ChevronRight, Edit, ExternalLink, Globe, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  addService,
  deleteService,
  getNginxConfig,
  getServices,
  updateService,
} from "./api/services";
import { getMe, logoutUser } from "./api/axios";
import { indicatorCategories, normalizeIndicatorCategory } from "./constants/serviceCategories";
import type { IndicatorCategory } from "./constants/serviceCategories";
import { Navbar } from "./components/Navbar";
import NginxConfigModal from "./components/NginxConfigModal";
import ServiceModal from "./components/ServiceModal";
import UserManager from "./components/UserManager";
import type {
  EditableIndicatorService,
  IndicatorService,
} from "./types/indicatorService";

const normalizeService = (
  service: Omit<IndicatorService, "srv_category"> & {
    srv_category?: string | null;
  },
): IndicatorService => ({
  ...service,
  srv_category: normalizeIndicatorCategory(service.srv_category),
  rt_enabled: service.rt_enabled ?? true,
});

const buildDefaultIndicator = (
  category: IndicatorCategory = "cpoe",
): EditableIndicatorService => ({
  srv_image: "/api/placeholder/200/150",
  srv_name: "",
  srv_ip: "",
  srv_desc: "",
  srv_category: category,
  rt_frontend_block: "",
  rt_backend_block: "",
  rt_enabled: true,
});

export default function Dashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRemoveLoading, setRemoveIsLoading] = useState<boolean>(false);
  const [services, setServices] = useState<IndicatorService[]>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [userManager, setUserManager] = useState<boolean>(false);
  const [nginxConfigModal, setNginxConfigModal] = useState<boolean>(false);
  const [nginxConfig, setNginxConfig] = useState<string | null>(null);
  const [isNginxLoading, setIsNginxLoading] = useState<boolean>(false);
  const [currentService, setCurrentService] =
    useState<EditableIndicatorService>(buildDefaultIndicator());
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeCategory, setActiveCategory] = useState<IndicatorCategory>("cpoe");
  const [isNavbarCondensed, setIsNavbarCondensed] = useState(false);
  const sectionRefs = useRef<Record<IndicatorCategory, HTMLElement | null>>({
    cpoe: null,
    adep: null,
    farmacia: null,
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const categoryGroups = indicatorCategories.map((category) => {
    const groupedServices = services.filter((service) => {
      const sameCategory =
        normalizeIndicatorCategory(service.srv_category) === category.value;

      if (!sameCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        service.srv_name.toLowerCase().includes(normalizedSearch) ||
        service.srv_ip.toLowerCase().includes(normalizedSearch) ||
        service.srv_desc.toLowerCase().includes(normalizedSearch)
      );
    });

    return {
      ...category,
      count: groupedServices.length,
      services: groupedServices,
    };
  });

  const totalVisibleIndicators = categoryGroups.reduce(
    (total, category) => total + category.services.length,
    0,
  );

  const scrollToCategory = (category: IndicatorCategory) => {
    setActiveCategory(category);
    const section = sectionRefs.current[category];

    if (section) {
      const top = section.getBoundingClientRect().top + window.scrollY - 118;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = window.scrollY;
      const scrollTop = currentScrollTop + 180;
      let currentCategory: IndicatorCategory = "cpoe";

      indicatorCategories.forEach((category) => {
        const section = sectionRefs.current[category.value];

        if (section) {
          const sectionTop = section.getBoundingClientRect().top + window.scrollY;

          if (sectionTop <= scrollTop) {
            currentCategory = category.value;
          }
        }
      });

      setActiveCategory((prev) =>
        prev === currentCategory ? prev : currentCategory,
      );
      setIsNavbarCondensed((prev) =>
        prev === (currentScrollTop > 24) ? prev : currentScrollTop > 24,
      );
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [normalizedSearch, services.length]);

  const refreshServices = async () => {
    const request = await getServices();
    setServices(
      (request.content as Array<
        Omit<IndicatorService, "srv_category"> & { srv_category?: string | null }
      >).map(normalizeService),
    );
  };

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

  const handleIndicatorClick = (ip: string): void => {
    window.open(`http://${ip}`, "_blank");
  };

  const handleEditClick = (
    e: React.MouseEvent,
    service: IndicatorService,
  ): void => {
    e.stopPropagation();
    setCurrentService(service);
    setPreviewImage(null);
    setSelectedFile(null);
    setIsEditMode(true);
    setModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setCurrentService(buildDefaultIndicator(activeCategory));
    setPreviewImage(null);
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setPreviewImage(null);
    setSelectedFile(null);
  };

  const handleUpdateService = async (): Promise<void> => {
    try {
      if (!("srv_id" in currentService) || !currentService.srv_id) return;

      setIsLoading(true);
      const formData = new FormData();
      formData.append("srv_name", currentService.srv_name);
      formData.append("srv_ip", currentService.srv_ip);
      formData.append("srv_desc", currentService.srv_desc);
      formData.append("srv_category", currentService.srv_category);
      formData.append(
        "rt_frontend_block",
        currentService.rt_frontend_block ?? "",
      );
      formData.append(
        "rt_backend_block",
        currentService.rt_backend_block ?? "",
      );
      formData.append("rt_enabled", String(currentService.rt_enabled ?? true));
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }

      await updateService(currentService.srv_id, formData);
      await refreshServices();
      handleCloseModal();
    } catch (err) {
      console.error("Error updating indicator:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (): Promise<void> => {
    try {
      if (!("srv_id" in currentService) || !currentService.srv_id) return;

      setRemoveIsLoading(true);
      await deleteService(currentService.srv_id);
      await refreshServices();
      handleCloseModal();
    } catch (err) {
      console.error("Error deleting indicator:", err);
    } finally {
      setRemoveIsLoading(false);
    }
  };

  const handleAddService = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("srv_name", currentService.srv_name);
      formData.append("srv_ip", currentService.srv_ip);
      formData.append("srv_desc", currentService.srv_desc);
      formData.append("srv_category", currentService.srv_category);
      formData.append(
        "rt_frontend_block",
        currentService.rt_frontend_block ?? "",
      );
      formData.append(
        "rt_backend_block",
        currentService.rt_backend_block ?? "",
      );
      formData.append("rt_enabled", String(currentService.rt_enabled ?? true));
      if (selectedFile) {
        formData.append("srv_image", selectedFile);
      }

      await addService(formData);
      await refreshServices();
      handleCloseModal();
    } catch (err) {
      console.error("Error adding indicator:", err);
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
        await refreshServices();
      } catch (err: unknown) {
        console.log("CallError", err);
      }
      setIsAdmin(localStorage.getItem("isAdmin") === "true");
    };

    const fetchMe = async () => {
      try {
        const me = await getMe();
        setUserName(me.user_name);
        setIsAdmin(me.is_admin);
      } catch {
        setIsAdmin(localStorage.getItem("isAdmin") === "true");
      }
    };

    populateServices();
    fetchMe();
  }, []);

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

  const getServiceImageSrc = (service: IndicatorService) => {
    if (!service.srv_image) {
      return null;
    }

    return `data:image/png;base64,${service.srv_image}`;
  };

  return (
    <div className="min-h-screen bg-[#edf3f2]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-4 px-3 pb-6 pt-3 sm:px-4 lg:gap-5 lg:px-5">
        <aside className="hidden w-[236px] shrink-0 lg:block">
          <div className="sticky top-4">
            <div className="rounded-[28px] border border-white bg-[#f6faf9] p-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="rounded-[22px] border border-[#d7e6e3] bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2e7675] shadow-[0_12px_24px_rgba(46,118,117,0.2)]">
                    <img
                      src="/s-i.webp"
                      alt="Indicadores"
                      className="h-auto w-7 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e7675]">
                      Navegacao
                    </p>
                    <p className="text-base font-black text-gray-900">Indicadores</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {categoryGroups.map((category) => {
                  const isActive = category.value === activeCategory;

                  return (
                    <button
                      key={category.value}
                      onClick={() => scrollToCategory(category.value)}
                      className={`group relative w-full overflow-hidden rounded-[22px] border px-4 py-3 text-left transition-all duration-300 ${
                        isActive
                          ? "border-[#2e7675]/15 bg-[#2e7675] text-white shadow-[0_16px_28px_rgba(46,118,117,0.22)]"
                          : "border-transparent bg-white text-gray-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-[#2e7675]/10 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                      }`}
                    >
                      <span
                        className={`absolute inset-y-3 left-2 w-1 rounded-full transition-all duration-300 ${
                          isActive
                            ? "bg-white/85"
                            : "bg-[#2e7675]/14 opacity-0 group-hover:opacity-100"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                            Modulo
                          </p>
                          <p className="mt-1 text-sm font-bold tracking-[0.02em]">
                            {category.label}
                          </p>
                        </div>
                        <div
                          className={`inline-flex min-w-[42px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                            isActive
                              ? "bg-white/16 text-white"
                              : "bg-[#2e7675]/8 text-[#2e7675]"
                          }`}
                        >
                          {category.count}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-40 bg-[#edf3f2] pb-3 pt-1 sm:pt-2">
            <Navbar
              handleLogout={handleLogout}
              setSearchTerm={setSearchTerm}
              searchTerm={searchTerm}
              isAdmin={isAdmin}
              userName={userName}
              onAddService={handleOpenAddModal}
              onManageUsers={() => setUserManager((prev) => !prev)}
              onViewNginxConfig={handleViewNginxConfig}
              isAddLoading={isLoading}
              isCondensed={isNavbarCondensed}
            />
          </div>

          <div className="sticky top-[78px] z-30 -mx-3 mb-3 flex gap-2 overflow-x-auto bg-[#edf3f2] px-3 py-1 sm:-mx-4 sm:px-4 lg:hidden">
            {categoryGroups.map((category) => {
              const isActive = category.value === activeCategory;

              return (
                <button
                  key={category.value}
                  onClick={() => scrollToCategory(category.value)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-300 ${
                    isActive
                      ? "border-[#2e7675] bg-[#2e7675] text-white shadow-[0_14px_24px_rgba(46,118,117,0.22)]"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {category.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? "bg-white/16 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>

          <main className="flex-1 pt-1">
            <div className="min-h-[260px]">
                {totalVisibleIndicators > 0 ? (
                  <div className="space-y-10">
                    {categoryGroups.map((category) => (
                      <section
                        key={category.value}
                        ref={(node) => {
                          sectionRefs.current[category.value] = node;
                        }}
                        className="min-h-[calc(100vh-9.5rem)] scroll-mt-32 border-b border-gray-200/90 pb-10 last:min-h-[calc(100vh-8rem)] last:border-b-0 last:pb-0"
                      >
                        <div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e7675]">
                              Modulo
                            </p>
                            <h2 className="mt-1 text-[1.4rem] font-black text-gray-900 sm:text-[1.55rem]">
                              {category.label}
                            </h2>
                          </div>
                          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2e7675]/12 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#2e7675]" />
                            {category.count} indicador{category.count === 1 ? "" : "es"}
                          </div>
                        </div>

                        {category.services.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {category.services.map((service) => (
                              <article
                                key={service.srv_id}
                                onClick={() => handleIndicatorClick(service.srv_ip)}
                                className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                              >
                                <div className="relative h-32 overflow-hidden bg-gray-100 sm:h-36">
                                  {getServiceImageSrc(service) ? (
                                    <img
                                      src={getServiceImageSrc(service) ?? ""}
                                      alt={service.srv_name}
                                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center bg-[#2e7675]/6 text-[#2e7675]/70">
                                      <Globe className="h-8 w-8" />
                                    </div>
                                  )}

                                  <div className="absolute inset-0 bg-[#2e7675]/88 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="flex h-full items-center justify-center">
                                      <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/14 px-4 py-2 text-sm font-semibold text-white">
                                        Abrir indicador
                                        <ExternalLink className="h-4 w-4" />
                                      </span>
                                    </div>
                                  </div>

                                  {!service.rt_enabled && (
                                    <div className="absolute bottom-3 left-3 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                                      Indisponivel
                                    </div>
                                  )}

                                  {isAdmin && (
                                    <button
                                      onClick={(e) => handleEditClick(e, service)}
                                      className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 text-gray-600 shadow-sm transition-colors hover:text-[#2e7675]"
                                      title="Editar indicador"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-1 flex-col p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-[15px] font-bold text-gray-900 transition-colors group-hover:text-[#2e7675]">
                                      {service.srv_name}
                                    </h3>
                                    <ChevronRight className="mt-1 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#2e7675]" />
                                  </div>

                                  <p className="mt-2 flex-1 text-sm leading-5 text-gray-600">
                                    {service.srv_desc || "Sem descricao disponivel."}
                                  </p>

                                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-[#2e7675]/8 px-3 py-1 text-[11px] font-medium text-[#2e7675]">
                                      <Globe className="h-3.5 w-3.5" />
                                      {service.srv_ip}
                                    </div>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-gray-300 bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
                            Nenhum indicador nesta categoria.
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white text-center shadow-sm">
                    <div className="rounded-full bg-gray-50 p-4">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                      Nenhum indicador encontrado
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-gray-500">
                      Nao encontramos indicadores com o termo pesquisado.
                    </p>
                  </div>
                )}
            </div>
          </main>
        </div>
      </div>

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

      {userManager && <UserManager onClose={() => setUserManager(false)} />}

      <NginxConfigModal
        isOpen={nginxConfigModal}
        onClose={() => setNginxConfigModal(false)}
        config={nginxConfig}
        isLoading={isNginxLoading}
      />
    </div>
  );
}
