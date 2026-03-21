import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addService,
  deleteService,
  getNginxConfig,
  getServices,
  updateService,
} from "../api/services";
import { getMe, logoutUser } from "../api/axios";
import {
  indicatorCategories,
  normalizeIndicatorCategory,
  buildDefaultIndicator,
  normalizeService,
  type IndicatorCategory,
  EditableIndicatorService,
  IndicatorService,
  IndicatorModuleSection,
  IndicatorsEmptyState,
} from "../features/indicators";
import {
  DashboardNavbar,
  DashboardSidebar,
  MobileCategoryTabs,
  type IndicatorCategoryGroup,
} from "../features/dashboard";
import { NginxConfigModal, ServiceModal, UserManager } from "../features/admin";

export default function DashboardPage() {
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

  const categoryGroups: IndicatorCategoryGroup[] = indicatorCategories.map(
    (category) => {
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
    },
  );

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

  const handleIndicatorClick = (service: IndicatorService) => {
    window.open(`http://${service.srv_ip}`, "_blank");
  };

  const handleEditClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    service: IndicatorService,
  ) => {
    event.stopPropagation();
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
        <DashboardSidebar
          categoryGroups={categoryGroups}
          activeCategory={activeCategory}
          onSelectCategory={scrollToCategory}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-40 bg-[#edf3f2] pb-3 pt-1 sm:pt-2">
            <DashboardNavbar
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

          <MobileCategoryTabs
            categoryGroups={categoryGroups}
            activeCategory={activeCategory}
            onSelectCategory={scrollToCategory}
          />

          <main className="flex-1 pt-1">
            <div className="min-h-[260px]">
              {totalVisibleIndicators > 0 ? (
                <div className="space-y-10">
                  {categoryGroups.map((category) => (
                    <IndicatorModuleSection
                      key={category.value}
                      category={category}
                      count={category.count}
                      services={category.services}
                      isAdmin={isAdmin}
                      sectionRef={(node) => {
                        sectionRefs.current[category.value] = node;
                      }}
                      getServiceImageSrc={getServiceImageSrc}
                      onOpenIndicator={handleIndicatorClick}
                      onEditIndicator={handleEditClick}
                    />
                  ))}
                </div>
              ) : (
                <IndicatorsEmptyState />
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
