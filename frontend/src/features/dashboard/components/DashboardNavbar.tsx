import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";

export interface DashboardNavbarProps {
  searchTerm: string;
  setSearchTerm: (dashboard: string) => void;
  handleLogout: () => void;
  isAdmin: boolean;
  userName: string;
  onAddService: () => void;
  onManageUsers: () => void;
  onViewNginxConfig: () => void;
  isAddLoading: boolean;
  isCondensed?: boolean;
}

export function DashboardNavbar({
  searchTerm,
  setSearchTerm,
  handleLogout,
  isAdmin,
  userName,
  onAddService,
  onManageUsers,
  onViewNginxConfig,
  isAddLoading,
  isCondensed = false,
}: DashboardNavbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className={`relative z-[60] flex items-center rounded-[24px] border px-2.5 transition-[min-height,padding,background-color,border-color,box-shadow] duration-300 ease-out sm:px-3 ${
        isCondensed
          ? "min-h-[44px] border-[#d8e5e0] bg-[#f8fcfa] py-0.5 "
          : "min-h-[76px] border-transparent bg-transparent py-2.5 "
      }`}
    >
      <div
        className={`w-full flex flex-col transition-[gap,min-height] duration-300 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:items-stretch ${
          isCondensed ? "gap-1 lg:min-h-[36px]" : "gap-3 lg:min-h-[58px]"
        }`}
      >
        <div
          className={`flex min-h-[58px] items-center gap-3 rounded-[20px] border px-3 py-2.5 transition-[min-height,padding,background-color,border-color,box-shadow] duration-300 ${
            isCondensed
              ? "min-h-[34px] border-transparent bg-transparent px-2 py-1 "
              : "border-[#d8e5e0] bg-white"
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-2xl border border-[#dce8e3] bg-[#f6fbf8] transition-[width,height] duration-300 ${
              isCondensed ? "h-8 w-8" : "h-12 w-12"
            }`}
          >
            <img
              src="/logo-colored.webp"
              alt="Indicadores"
              className={`h-auto object-contain transition-[width] duration-300 ${
                isCondensed ? "w-5" : "w-8"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p
              className={`dashboard-label text-[#2e7675] ${
                isCondensed ? "text-[8px]" : "text-[10px]"
              }`}
            >
              Hospital Samur
            </p>
            <p
              className={`font-dashboard-display truncate tracking-[0.01em] text-[#214f4e] ${
                isCondensed
                  ? "text-sm font-bold leading-none"
                  : "text-[1.10rem] font-bold"
              }`}
            >
              Indicadores
            </p>
          </div>
        </div>

        <div
          className={`flex min-h-[58px] items-center gap-2.5 rounded-[20px] border px-2.5 py-2.5 transition-[min-height,padding,background-color,border-color,box-shadow] duration-300 ${
            isCondensed
              ? "min-h-[34px] border-transparent bg-transparent py-1"
              : "border-[#d8e5e0] bg-white "
          }`}
        >
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar indicadores..."
              className={`block w-full rounded-[16px] border border-[#dbe7e2] bg-[#fbfdfc] pl-11 pr-4 text-[13px] font-medium text-gray-900 outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-gray-400 focus:border-[#2e7675]/30 focus:bg-white focus:ring-4 focus:ring-[#2e7675]/10 ${
                isCondensed ? "h-8" : "h-10"
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className={`inline-flex shrink-0 items-center border border-[#dbe7e2] text-left transition-[width,padding,border-color,background-color,box-shadow] duration-300 hover:border-[#2e7675]/20 hover:bg-white ${
                isCondensed
                  ? "h-8 w-8 justify-center rounded-[14px] bg-white px-0 "
                  : "h-10 gap-3 rounded-[16px] bg-[#fbfdfc] px-3"
              }`}
              title="Minha conta"
            >
              <div
                className={`flex items-center justify-center rounded-xl bg-[#2e7675]/10 text-[#2e7675] transition-[width,height] duration-300 ${
                  isCondensed ? "h-6 w-6" : "h-8 w-8"
                }`}
              >
                <UserCircle className="h-4.5 w-4.5" />
              </div>
              <div
                className={`min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-[200ms] ${
                  isCondensed
                    ? "max-w-0 translate-x-1 opacity-0"
                    : "hidden max-w-[180px] opacity-100 sm:block"
                }`}
              >
                <p className="max-w-[150px] truncate text-[13px] font-semibold text-gray-900">
                  {userName || "Usuario"}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-500">
                  {isAdmin ? "Administrador" : "Acesso padrao"}
                </p>
              </div>
              {!isCondensed && (
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform duration-[200ms] ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-[80] mt-3 w-[280px] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.1)]">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e7675]/12 text-[#2e7675]">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-900">
                        {userName || "Usuario"}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#2e7675]/8 px-2 py-1 text-[11px] font-medium text-[#2e7675]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {isAdmin ? "Administrador" : "Usuario"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onAddService();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
                      >
                        {isAddLoading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Adicionar indicador
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onManageUsers();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
                      >
                        <Users className="h-4 w-4" />
                        Gerenciar usuarios
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onViewNginxConfig();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
                      >
                        <Settings className="h-4 w-4" />
                        Configuracao NGINX
                      </button>
                      <div className="my-2 h-px bg-gray-100" />
                    </>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
