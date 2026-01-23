// src/components/Navbar.tsx
import React from "react";
import {
  LogOut,
  Search,
  Plus,
  Users,
  LoaderCircle,
  Settings,
} from "lucide-react";

export interface NavbarProps {
  searchTerm: string;
  setSearchTerm: (dashboard: string) => void;
  handleLogout: () => void;
  isAdmin: boolean;
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
  onAddService,
  onManageUsers,
  onViewNginxConfig,
  isAddLoading,
}) => {
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
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/40 hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
