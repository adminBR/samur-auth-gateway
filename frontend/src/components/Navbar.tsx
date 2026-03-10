// src/components/Navbar.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  LogOut,
  Search,
  Plus,
  Users,
  LoaderCircle,
  Settings,
  UserCircle,
  ShieldCheck,
  User,
} from "lucide-react";

export interface NavbarProps {
  searchTerm: string;
  setSearchTerm: (dashboard: string) => void;
  handleLogout: () => void;
  isAdmin: boolean;
  userName: string;
  onAddService: () => void;
  onManageUsers: () => void;
  onViewNginxConfig: () => void;
  isAddLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchTerm,
  setSearchTerm,
  handleLogout,
  isAdmin,
  userName,
  onAddService,
  onManageUsers,
  onViewNginxConfig,
  isAddLoading,
}) => {
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
    <nav className="w-full bg-[#2e7675] shadow-md text-gray-100">
      <div className="w-full px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex justify-center items-center">
            <img src="s-i.webp" className="w-10" />
            <div className="mx-4 h-10 w-px bg-white/30"></div>
            <span className=" text-xl font-semibold text-gray-100">
              Painel de serviços
            </span>
          </div>

          <div className="flex-1 min-w-[240px] max-w-xl">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search
                  className={`h-5 w-5 transition-colors duration-300 ${
                    searchTerm
                      ? "text-gray-500"
                      : "text-white/60 group-focus-within:text-gray-500"
                  }`}
                />
              </div>
              <input
                type="text"
                placeholder="Pesquisar paineis..."
                className={`block w-full pl-10 pr-3 py-2 rounded-lg leading-5 transition-all duration-300 outline-none sm:text-sm border border-transparent
                  ${
                    searchTerm
                      ? "bg-white text-gray-900 placeholder-gray-500 shadow-sm"
                      : "bg-white/10 text-white placeholder-white/60 hover:bg-white/20 focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 focus:shadow-lg"
                  }
                `}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onAddService}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                >
                  {isAddLoading ? (
                    <LoaderCircle className="animate-spin h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">Adicionar serviço</span>
                </button>
                <button
                  onClick={onManageUsers}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden md:inline">Gerenciar usuários</span>
                </button>
                <button
                  onClick={onViewNginxConfig}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                  title="Ver configuração NGINX"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline">Config NGINX</span>
                </button>
              </div>
            )}

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                title="Minha conta"
              >
                <UserCircle className="h-5 w-5" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {userName || "Usuário"}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#2e7675]/15 text-[#2e7675] flex items-center justify-center">
                        <UserCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {userName || "Usuário"}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isAdmin ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5 text-[#2e7675]" />
                              <span className="text-xs text-[#2e7675] font-medium">
                                Administrador
                              </span>
                            </>
                          ) : (
                            <>
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                Usuário
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
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
      </div>
    </nav>
  );
};
