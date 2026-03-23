import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addService,
  deleteService,
  getNginxConfig,
  getServiceCategories,
  getServices,
  updateService,
} from "../api/services";
import { getMe, logoutUser } from "../api/axios";
import {
  buildDefaultIndicator,
  normalizeService,
  type IndicatorCategory,
  type IndicatorCategoryOption,
  EditableIndicatorService,
  IndicatorService,
  IndicatorModuleSection,
  IndicatorsEmptyState,
  toIndicatorCategoryOption,
  type ServiceCategory,
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
  const [categories, setCategories] = useState<IndicatorCategoryOption[]>([]);
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
  const [activeCategory, setActiveCategory] = useState<IndicatorCategory | null>(
    null,
  );
  const [isNavbarCondensed, setIsNavbarCondensed] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const categoryGroups: IndicatorCategoryGroup[] = categories.map(
    (category) => {
      const groupedServices = services.filter((service) => {
        const sameCategory = service.srv_category === category.value;

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
      const top = section.getBoundingClientRect().top + window.scrollY - 108;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategory(null);
      return;
    }

    setActiveCategory((prev) => {
      if (prev !== null && categories.some((category) => category.value === prev)) {
        return prev;
      }

      return categories[0].value;
    });
  }, [categories]);

  useEffect(() => {
    let rafId = 0;
    let ticking = false;

    if (categories.length === 0) {
      return;
    }

    const syncScrollState = () => {
      const currentScrollTop = Math.max(window.scrollY, 0);
      const scrollTop = currentScrollTop + 200;
      let currentCategory: IndicatorCategory | null = categories[0]?.value ?? null;

      categories.forEach((category) => {
        const section = sectionRefs.current[category.value];

        if (section) {
          const sectionTop = section.getBoundingClientRect().top + window.scrollY;

          if (sectionTop <= scrollTop) {
            currentCategory = category.value;
          }
        }
      });

      if (currentCategory !== null) {
        setActiveCategory((prev) =>
          prev === currentCategory ? prev : currentCategory,
        );
      }
      setIsNavbarCondensed((prev) => {
        if (currentScrollTop <= 8) {
          return prev ? false : prev;
        }

        if (currentScrollTop >= 64) {
          return prev ? prev : true;
        }

        return prev;
      });
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      rafId = window.requestAnimationFrame(syncScrollState);
    };

    syncScrollState();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(rafId);
    };
  }, [categories]);

  const refreshCategories = async () => {
    const request = await getServiceCategories();
    setCategories(
      (request.content as ServiceCategory[]).map(toIndicatorCategoryOption),
    );
  };

  const refreshServices = async () => {
    const request = await getServices();
    setServices(
      (request.content as Array<
        Omit<IndicatorService, "srv_category"> & {
          srv_category?: number | string | null;
        }
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
    setCurrentService(
      buildDefaultIndicator(activeCategory ?? categories[0]?.value ?? 0),
    );
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
      formData.append("srv_category", String(currentService.srv_category));
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
      formData.append("srv_category", String(currentService.srv_category));
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
        await Promise.all([refreshCategories(), refreshServices()]);
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
    <div className="font-dashboard-sans relative min-h-screen bg-[#edf5f1] text-[#223432]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(181,225,202,0.34),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(46,118,117,0.14),transparent_28%),linear-gradient(180deg,#f7fcfa_0%,#edf5f1_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,118,117,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,118,117,0.045)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-12 bg-[linear-gradient(180deg,rgba(15,23,42,0.26)_0%,rgba(15,23,42,0.1)_48%,transparent_100%)] blur-lg" />

      <div className="sticky top-0 z-50 px-2 pb-2 pt-2 sm:px-3 sm:pt-3 lg:px-4">
        <div className="pointer-events-none absolute inset-x-0 -bottom-4 h-14 bg-[linear-gradient(180deg,rgba(15,23,42,0.42)_0%,rgba(15,23,42,0.22)_34%,rgba(15,23,42,0.08)_62%,transparent_100%)] opacity-65 blur-2xl" />
        <div className="mx-auto max-w-[1640px]">
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
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1640px] items-start gap-3 px-2 pb-8 pt-1 sm:px-3 lg:gap-4 lg:px-4">
        <DashboardSidebar
          categoryGroups={categoryGroups}
          activeCategory={activeCategory}
          onSelectCategory={scrollToCategory}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileCategoryTabs
            categoryGroups={categoryGroups}
            activeCategory={activeCategory}
            onSelectCategory={scrollToCategory}
          />

          <main className="-mt-4 flex-1 pt-10 sm:-mt-5 sm:pt-12">
            <div className="min-h-[260px]">
              {totalVisibleIndicators > 0 ? (
                <div className="space-y-5">
                  {categoryGroups.map((category) => (
                    <IndicatorModuleSection
                      key={category.value}
                      category={category}
                      count={category.count}
                      services={category.services}
                      isAdmin={isAdmin}
                      isActive={category.value === activeCategory}
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
        categories={categories}
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
