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
      className={`relative z-[60] border bg-white transition-all duration-300 ease-out ${
        isCondensed
          ? "rounded-[18px] border-gray-300 px-3 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.12)] sm:px-4"
          : "rounded-[24px] border-gray-200 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:px-5"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-3 lg:max-w-[42rem]">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar indicadores..."
              className={`block w-full border pl-11 pr-4 text-sm text-gray-900 outline-none transition-all duration-300 focus:border-[#2e7675]/30 focus:bg-white focus:ring-4 focus:ring-[#2e7675]/10 ${
                isCondensed
                  ? "rounded-[16px] border-gray-200 bg-white py-2"
                  : "rounded-[18px] border-gray-200 bg-gray-50 py-3"
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end lg:pl-4">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className={`inline-flex items-center gap-3 border text-left transition-all duration-300 hover:border-[#2e7675]/20 hover:bg-white ${
                isCondensed
                  ? "rounded-[16px] border-gray-200 bg-white px-2.5 py-1.5 shadow-sm"
                  : "rounded-[20px] border-gray-200 bg-gray-50 px-3.5 py-2"
              }`}
              title="Minha conta"
            >
              <div
                className={`flex items-center justify-center rounded-xl bg-[#2e7675]/10 text-[#2e7675] ${
                  isCondensed ? "h-9 w-9" : "h-10 w-10"
                }`}
              >
                <UserCircle className="h-5 w-5" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[150px] truncate text-sm font-semibold text-gray-900">
                  {userName || "Usuario"}
                </p>
                <p className="text-xs text-gray-500">
                  {isAdmin ? "Administrador" : "Acesso padrao"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-[80] mt-3 w-[280px] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e7675]/12 text-[#2e7675]">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
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
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
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
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
                      >
                        <Users className="h-4 w-4" />
                        Gerenciar usuarios
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onViewNginxConfig();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-[#2e7675]/6 hover:text-[#2e7675]"
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
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
