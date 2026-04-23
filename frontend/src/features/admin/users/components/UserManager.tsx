/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  LoaderCircle,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  AdminService,
  NewUserPayload,
  UpdateUserPayload,
  User,
  createUserAdmin,
  deleteUserAdmin,
  getAllServicesForAdmin,
  getAllUsersAdmin,
  getMe,
  updateUserAdmin,
} from "../../../../api/axios";

type SortKey =
  | "username"
  | "is_admin"
  | "is_tasy"
  | "access_count"
  | "jwt_expiration"
  | "created_at";

type SortDirection = "asc" | "desc";

type AccessFilterValue = "all" | "none" | `${number}`;

const DEFAULT_JWT_EXPIRATION = "1";
const PROTECTED_ADMIN_USER_ID = 1;

function isProtectedAdminUser(user?: Pick<User, "id"> | null) {
  return user?.id === PROTECTED_ADMIN_USER_ID;
}

function parseAccessIds(access: string | undefined) {
  return String(access || "")
    .split(",")
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

function compareBoolean(a: boolean, b: boolean) {
  if (a === b) {
    return 0;
  }

  return a ? 1 : -1;
}

function compareDates(a?: string, b?: string) {
  const timeA = a ? new Date(a).getTime() : 0;
  const timeB = b ? new Date(b).getTime() : 0;

  if (timeA === timeB) {
    return 0;
  }

  return timeA > timeB ? 1 : -1;
}

function compareJwtExpiration(a: string, b: string) {
  if (a === b) {
    return 0;
  }

  if (a === "inf") {
    return 1;
  }

  if (b === "inf") {
    return -1;
  }

  return Number(a) - Number(b);
}

function formatJwtExpiration(value: string) {
  return value === "inf" ? "Infinito" : "Padrao";
}

function formatCreatedAt(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

function sortUsers(users: User[], sortKey: SortKey, direction: SortDirection) {
  const sorted = [...users].sort((left, right) => {
    switch (sortKey) {
      case "username":
        return compareText(left.username, right.username);
      case "is_admin":
        return compareBoolean(left.is_admin, right.is_admin);
      case "is_tasy":
        return compareBoolean(Boolean(left.is_tasy), Boolean(right.is_tasy));
      case "access_count":
        return (
          parseAccessIds(left.access).length -
          parseAccessIds(right.access).length
        );
      case "jwt_expiration":
        return compareJwtExpiration(left.jwt_expiration, right.jwt_expiration);
      case "created_at":
        return compareDates(left.created_at, right.created_at);
      default:
        return 0;
    }
  });

  if (direction === "desc") {
    sorted.reverse();
  }

  return sorted;
}

function UserFormModal({
  title,
  submitLabel,
  isLoading,
  error,
  services,
  username,
  setUsername,
  isUsernameDisabled = false,
  password,
  setPassword,
  isAdmin,
  setIsAdmin,
  endlessJwt,
  setEndlessJwt,
  selectedServiceIds,
  onToggleService,
  onSubmit,
  onClose,
  passwordPlaceholder,
  isTasyUser = false,
}: {
  title: string;
  submitLabel: string;
  isLoading: boolean;
  error: string | null;
  services: AdminService[];
  username: string;
  setUsername?: (value: string) => void;
  isUsernameDisabled?: boolean;
  password: string;
  setPassword: (value: string) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  endlessJwt: boolean;
  setEndlessJwt: (value: boolean) => void;
  selectedServiceIds: Set<number>;
  onToggleService: (serviceId: number) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  passwordPlaceholder: string;
  isTasyUser?: boolean;
}) {
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const normalizedServiceSearch = serviceSearchTerm.trim().toLowerCase();
  const visibleServices = services.filter((service) =>
    service.srv_name.toLowerCase().includes(normalizedServiceSearch),
  );

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0f172a]/55 p-4 backdrop-blur-sm">
      <div className="mx-auto my-4 flex w-full max-w-6xl flex-col rounded-[24px] border border-[#d7e4de] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e3ede9] px-5 py-4 sm:px-6">
          <div>
            <p className="dashboard-label text-[10px] text-[#2e7675]">
              Administracao de usuarios
            </p>
            <h2 className="font-dashboard-display mt-1.5 text-[1.35rem] font-bold text-[#203735]">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d7e4de] bg-[#f8fcfa] p-2 text-[#58726f] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-5 sm:px-6">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(450px,1.2fr)]">
            <div className="space-y-3">
              <section className="rounded-[18px] border border-[#deebe6] bg-[#fbfdfc] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#355754]">
                  Dados principais
                </h3>

                <label className="block text-sm font-semibold text-[#355754]">
                  Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername?.(event.target.value)}
                  disabled={isUsernameDisabled}
                  placeholder="Digite o nome de usuario"
                  className="mt-2 h-10 w-full rounded-[14px] border border-[#d7e4de] bg-white px-3.5 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 disabled:cursor-not-allowed disabled:text-[#6c8581]"
                />
                <p className="mt-1.5 text-xs leading-6 text-[#68817d]">
                  {isUsernameDisabled
                    ? "O nome de usuario fica bloqueado na edicao para preservar a referencia do cadastro."
                    : "Defina o identificador que sera usado para localizar esta conta."}
                </p>

                <label className="block pt-3 text-sm font-semibold text-[#355754]">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={passwordPlaceholder}
                  className="mt-2 h-10 w-full rounded-[14px] border border-[#d7e4de] bg-white px-3.5 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40"
                />
                {isTasyUser ? (
                  <p className="mt-1.5 text-xs leading-6 text-[#5b7672]">
                    Usuario Tasy continua autenticando no sistema externo. Este
                    campo permanece aqui apenas para manter o fluxo interno de
                    edicao centralizado nesta tela.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs leading-6 text-[#68817d]">
                    Preencha apenas quando quiser definir ou alterar a senha
                    usada neste painel.
                  </p>
                )}
              </section>

              <section className="rounded-[18px] border border-[#deebe6] bg-[#fbfdfc] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#355754]">
                  Permissoes e sessao
                </h3>

                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 rounded-[14px] border border-[#deebe6] bg-white px-3.5 py-3 text-sm text-[#355754]">
                    <input
                      type="checkbox"
                      checked={isAdmin}
                      onChange={(event) => setIsAdmin(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2e7675] focus:ring-[#2e7675]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        Perfil administrador
                      </span>
                      <span className="mt-1 block text-xs leading-6 text-[#68817d]">
                        Libera acesso a usuarios, configuracoes, analytics e
                        outros recursos administrativos.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-[14px] border border-[#deebe6] bg-white px-3.5 py-3 text-sm text-[#355754]">
                    <input
                      type="checkbox"
                      checked={endlessJwt}
                      onChange={(event) => setEndlessJwt(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2e7675] focus:ring-[#2e7675]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        Sessao infinita
                      </span>
                      <span className="mt-1 block text-xs leading-6 text-[#68817d]">
                        Mantem a sessao sem expiracao padrao. Indicado apenas
                        para acessos controlados pela equipe.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              {error ? (
                <div className="rounded-[18px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b14949]">
                  {error}
                </div>
              ) : null}
            </div>

            <section className="flex h-[420px] flex-col rounded-[18px] border border-[#deebe6] bg-[#f8fcfa] p-4 sm:h-[500px] lg:h-[560px]">
              <div className="flex items-start justify-between gap-3 border-b border-[#deebe6] pb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#355754]">
                    Indicadores liberados
                  </h3>
                  <div className="relative mt-3 max-w-md">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Search className="h-4 w-4 text-[#7f9692]" />
                    </div>
                    <input
                      type="text"
                      value={serviceSearchTerm}
                      onChange={(event) =>
                        setServiceSearchTerm(event.target.value)
                      }
                      placeholder="Buscar indicador pelo nome"
                      className="h-10 w-full rounded-[12px] border border-[#d7e4de] bg-white pl-10 pr-3 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40"
                    />
                  </div>
                </div>
                <div className="rounded-full border border-[#d6e4de] bg-white px-3 py-1 text-[11px] font-semibold text-[#476361]">
                  {selectedServiceIds.size} selecionado(s)
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[14px] border border-[#d6e4de] bg-white">
                {!services.length ? (
                  <p className="px-4 py-4 text-sm text-[#5b7672]">
                    Nenhum indicador disponivel para vinculacao.
                  </p>
                ) : !visibleServices.length ? (
                  <p className="px-4 py-4 text-sm text-[#5b7672]">
                    Nenhum indicador encontrado para esta busca.
                  </p>
                ) : (
                  <div className="h-full overflow-y-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-[#f4faf7]">
                        <tr className="border-b border-[#dce8e3]">
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                            ID
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                            Indicador
                          </th>
                          <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                            Liberado
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleServices.map((service) => (
                          <tr
                            key={service.srv_id}
                            className="border-b border-[#edf3f0] text-sm text-[#243f3d] last:border-b-0"
                          >
                            <td className="px-4 py-3 align-middle text-xs font-semibold text-[#6b8480]">
                              {service.srv_id}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <span className="block text-[13px] font-semibold leading-5 text-[#243f3d]">
                                {service.srv_name}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              <input
                                type="checkbox"
                                checked={selectedServiceIds.has(service.srv_id)}
                                onChange={() => onToggleService(service.srv_id)}
                                className="h-4 w-4 rounded border-gray-300 text-[#2e7675] focus:ring-[#2e7675]"
                                aria-label={`Liberar indicador ${service.srv_name}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 flex justify-end gap-3 border-t border-[#e3ede9] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] border border-[#d7e4de] bg-white px-4 py-2.5 text-sm font-semibold text-[#385451] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#2e7675] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#285f5f] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  user,
  error,
  isLoading,
  onConfirm,
  onClose,
}: {
  user: User;
  error: string | null;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[#e4cfcf] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1f1] text-[#c45757]">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-center text-xl font-bold text-[#203735]">
          Remover usuario
        </h2>
        <p className="mt-3 text-center text-sm leading-7 text-[#5b7672]">
          Tem certeza que deseja remover <strong>{user.username}</strong>? Esta
          acao nao pode ser desfeita.
        </p>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b14949]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[16px] border border-[#d7e4de] bg-white px-4 py-2.5 text-sm font-semibold text-[#385451] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#c45757] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ae4747] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Confirmar exclusao
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManager() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<AdminService[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tasyFilter, setTasyFilter] = useState<"all" | "tasy" | "local">("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilterValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("username");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newEndlessJwt, setNewEndlessJwt] = useState(false);
  const [newSelectedServiceIds, setNewSelectedServiceIds] = useState<
    Set<number>
  >(new Set());

  const [editPassword, setEditPassword] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editEndlessJwt, setEditEndlessJwt] = useState(false);
  const [editSelectedServiceIds, setEditSelectedServiceIds] = useState<
    Set<number>
  >(new Set());

  const servicesById = allServices.reduce<Record<number, AdminService>>(
    (lookup, service) => {
      lookup[service.srv_id] = service;
      return lookup;
    },
    {},
  );

  const filteredUsers = users.filter((user) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const userAccessIds = parseAccessIds(user.access);

    if (
      normalizedSearch &&
      !user.username.toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }

    if (tasyFilter === "tasy" && !user.is_tasy) {
      return false;
    }

    if (tasyFilter === "local" && user.is_tasy) {
      return false;
    }

    if (accessFilter === "none" && userAccessIds.length > 0) {
      return false;
    }

    if (
      accessFilter !== "all" &&
      accessFilter !== "none" &&
      !userAccessIds.includes(Number(accessFilter))
    ) {
      return false;
    }

    return true;
  });

  const visibleUsers = sortUsers(filteredUsers, sortKey, sortDirection);

  const totalUsers = users.length;

  const loadPageData = async () => {
    setPageError(null);

    try {
      const [me, services, usersResponse] = await Promise.all([
        getMe(),
        getAllServicesForAdmin(),
        getAllUsersAdmin(),
      ]);

      if (!me.is_admin) {
        navigate("/", { replace: true });
        return;
      }

      setAllServices(services);
      setUsers(usersResponse);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        "Nao foi possivel carregar o gerenciamento de usuarios.";
      setPageError(message);
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  const resetAddForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewIsAdmin(false);
    setNewEndlessJwt(false);
    setNewSelectedServiceIds(new Set());
    setModalError(null);
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const openEditModal = (user: User) => {
    if (isProtectedAdminUser(user)) {
      return;
    }

    setCurrentUser(user);
    setEditPassword("");
    setEditIsAdmin(user.is_admin);
    setEditEndlessJwt(user.jwt_expiration === "inf");
    setEditSelectedServiceIds(new Set(parseAccessIds(user.access)));
    setModalError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    if (isProtectedAdminUser(user)) {
      return;
    }

    setCurrentUser(user);
    setModalError(null);
    setShowDeleteModal(true);
  };

  const closeAllModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setCurrentUser(null);
    setModalError(null);
  };

  const toggleNewService = (serviceId: number) => {
    setNewSelectedServiceIds((previous) => {
      const next = new Set(previous);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const toggleEditService = (serviceId: number) => {
    setEditSelectedServiceIds((previous) => {
      const next = new Set(previous);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleApiError = (error: any, fallbackMessage: string) => {
    const message =
      error?.response?.data?.detail || error?.message || fallbackMessage;
    setModalError(message);
  };

  const handleAddUser = async (event: FormEvent) => {
    event.preventDefault();

    if (!newUsername.trim() || !newPassword.trim()) {
      setModalError("Informe usuario e senha para criar a conta.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const payload: NewUserPayload = {
      user_name: newUsername.trim(),
      user_pass: newPassword,
      is_admin: newIsAdmin,
      access: Array.from(newSelectedServiceIds).join(","),
      jwt_expiration: newEndlessJwt ? "inf" : DEFAULT_JWT_EXPIRATION,
    };

    try {
      await createUserAdmin(payload);
      await loadPageData();
      closeAllModals();
    } catch (error) {
      handleApiError(error, "Nao foi possivel criar o usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (isProtectedAdminUser(currentUser)) {
      setModalError("O usuario admin principal nao pode ser editado.");
      return;
    }

    const payload: UpdateUserPayload = {
      is_admin: editIsAdmin,
      access: Array.from(editSelectedServiceIds).join(","),
      jwt_expiration: editEndlessJwt ? "inf" : DEFAULT_JWT_EXPIRATION,
    };

    if (editPassword.trim()) {
      payload.user_pass = editPassword;
    }

    const originalAccess = new Set(parseAccessIds(currentUser.access));
    const hasPasswordChange = Boolean(payload.user_pass);
    const hasAdminChange = editIsAdmin !== currentUser.is_admin;
    const hasJwtChange = payload.jwt_expiration !== currentUser.jwt_expiration;
    const hasAccessChange =
      originalAccess.size !== editSelectedServiceIds.size ||
      Array.from(editSelectedServiceIds).some(
        (serviceId) => !originalAccess.has(serviceId),
      );

    if (
      !hasPasswordChange &&
      !hasAdminChange &&
      !hasJwtChange &&
      !hasAccessChange
    ) {
      setModalError("Nenhuma alteracao foi feita.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await updateUserAdmin(currentUser.id, payload);
      await loadPageData();
      closeAllModals();
    } catch (error) {
      handleApiError(error, "Nao foi possivel atualizar o usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser) {
      return;
    }

    if (isProtectedAdminUser(currentUser)) {
      setModalError("O usuario admin principal nao pode ser removido.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await deleteUserAdmin(currentUser.id);
      await loadPageData();
      closeAllModals();
    } catch (error) {
      handleApiError(error, "Nao foi possivel remover o usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  };

  const renderSortIcon = (columnKey: SortKey) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-[#7f9692]" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-[#2e7675]" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-[#2e7675]" />
    );
  };

  const renderAccessBadges = (user: User) => {
    const accessIds = parseAccessIds(user.access);

    if (!accessIds.length) {
      return (
        <span className="inline-flex rounded-full border border-[#dce8e3] bg-[#f8fcfa] px-2.5 py-1 text-[11px] font-semibold text-[#6b8480]">
          Sem acesso
        </span>
      );
    }

    const labels = accessIds.map((serviceId) => ({
      id: serviceId,
      label: servicesById[serviceId]?.srv_name || `ID ${serviceId}`,
    }));
    const visibleLabels = labels.slice(0, 2);
    const hiddenCount = labels.length - visibleLabels.length;

    return (
      <div className="flex flex-wrap gap-1.5">
        {visibleLabels.map((item) => (
          <span
            key={item.id}
            className="inline-flex rounded-full border border-[#d5e4de] bg-[#f4faf7] px-2.5 py-1 text-[11px] font-semibold text-[#355754]"
            title={item.label}
          >
            {item.label}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span className="inline-flex rounded-full border border-[#dce8e3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6b8480]">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="font-dashboard-sans relative min-h-screen overflow-x-hidden bg-[#edf5f1] text-[#223432]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(181,225,202,0.26),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(46,118,117,0.12),transparent_24%),linear-gradient(180deg,#f8fcfa_0%,#edf5f1_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,118,117,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,118,117,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60" />
      </div>

      <div className="relative mx-auto max-w-[1640px] px-3 pb-5 pt-3 sm:px-4 lg:px-6">
        <header className="px-1 py-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#dce8e3] bg-[#f6fbf8]">
                <img
                  src="/logo-colored.webp"
                  alt="Usuarios"
                  className="h-auto w-8 object-contain"
                />
              </div>
              <div className="flex min-h-14 items-center">
                <div className="text-center">
                  <h1 className="font-dashboard-display text-[1.85rem] font-bold text-[#203735]">
                    Usuarios
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex items-center gap-2 rounded-full border border-[#d9e7e2] bg-white px-4 py-2 text-[12px] font-semibold text-[#385451] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao painel
              </button>
            </div>
          </div>
        </header>

        <section className="mt-3 rounded-[26px] border border-[#d7e4de] bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_180px_240px_108px]">
              <label className="block">
                <span className="sr-only">Buscar por nome</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-4 w-4 text-[#7f9692]" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar usuario"
                    className="h-11 w-full rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] pl-11 pr-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                  />
                </div>
              </label>

              <label className="block">
                <span className="sr-only">Origem</span>
                <select
                  value={tasyFilter}
                  onChange={(event) =>
                    setTasyFilter(
                      event.target.value as "all" | "tasy" | "local",
                    )
                  }
                  className="h-11 w-full rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                >
                  <option value="all">Origem: todos</option>
                  <option value="local">Origem: locais</option>
                  <option value="tasy">Origem: Tasy</option>
                </select>
              </label>

              <label className="block">
                <span className="sr-only">Filtrar por acesso</span>
                <select
                  value={accessFilter}
                  onChange={(event) =>
                    setAccessFilter(event.target.value as AccessFilterValue)
                  }
                  className="h-11 w-full rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                >
                  <option value="all">Todos os acessos</option>
                  <option value="none">Sem indicadores</option>
                  {allServices.map((service) => (
                    <option key={service.srv_id} value={String(service.srv_id)}>
                      {service.srv_name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setTasyFilter("all");
                  setAccessFilter("all");
                }}
                className="h-11 rounded-[16px] border border-[#d7e4de] bg-white px-4 text-[13px] font-semibold text-[#385451] transition-colors hover:border-[#bfd5cf] hover:bg-[#f8fcfa]"
              >
                Limpar
              </button>
            </div>

            <div className="hidden h-11 w-px bg-[#dce8e3] xl:block" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:flex-none">
              <div className="flex h-11 min-w-[154px] items-center justify-between rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] px-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#617b77]">
                  Usuarios
                </span>
                <span className="font-dashboard-display text-[1.55rem] font-bold leading-none text-[#203735]">
                  {totalUsers}
                </span>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-11 appearance-none items-center justify-center gap-2 rounded-[16px] border border-[#2e7675] bg-[#2e7675] px-5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#275f5e] focus:outline-none"
              >
                <UserPlus className="h-4 w-4" />
                Novo usuario
              </button>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[28px] border border-[#d7e4de] bg-white/90 p-4 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-[#5b7672]">
                {visibleUsers.length} usuários encontrados.
              </p>
            </div>
          </div>

          {pageError && !isBootstrapping ? (
            <div className="mt-4 rounded-[18px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b14949]">
              {pageError}
            </div>
          ) : null}

          {isBootstrapping ? (
            <div className="mt-8 flex flex-col items-center justify-center py-20 text-[#5b7672]">
              <LoaderCircle className="mb-3 h-10 w-10 animate-spin text-[#2e7675]" />
              <p>Carregando usuarios e acessos...</p>
            </div>
          ) : visibleUsers.length ? (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[#e1ebe7]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#e1ebe7]">
                  <thead className="bg-[#f7fbf9]">
                    <tr>
                      {[
                        { label: "Usuario", key: "username" },
                        { label: "", key: "is_admin" },
                        { label: "Tasy", key: "is_tasy" },
                        { label: "Acessos", key: "access_count" },
                        { label: "Sessao", key: "jwt_expiration" },
                        { label: "Criado em", key: "created_at" },
                      ].map((column) => (
                        <th
                          key={column.key}
                          className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]"
                        >
                          {column.label ? (
                            <button
                              type="button"
                              onClick={() => handleSort(column.key as SortKey)}
                              className="inline-flex items-center gap-2 transition-colors hover:text-[#2e7675]"
                            >
                              {column.label}
                              {renderSortIcon(column.key as SortKey)}
                            </button>
                          ) : null}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                        Acoes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ecf2ef] bg-white">
                    {visibleUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-[#f8fcfa]"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="min-w-[220px]">
                            <p className="text-sm font-semibold text-[#203735]">
                              {user.username}
                            </p>
                            <p className="mt-1 text-xs text-[#68817d]">
                              ID {user.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {user.is_admin ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe3dc] bg-[#eff8f4] px-2.5 py-1 text-[11px] font-semibold text-[#2e7675]">
                              <Check className="h-3.5 w-3.5" />
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-[#dce8e3] bg-[#f8fcfa] px-2.5 py-1 text-[11px] font-semibold text-[#6b8480]">
                              Nao
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {user.is_tasy ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#d1dfeb] bg-[#f2f8fd] px-2.5 py-1 text-[11px] font-semibold text-[#35607e]">
                              <UserCog className="h-3.5 w-3.5" />
                              Tasy
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-[#dce8e3] bg-[#f8fcfa] px-2.5 py-1 text-[11px] font-semibold text-[#6b8480]">
                              Local
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="min-w-[240px] space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7a918d]">
                              {parseAccessIds(user.access).length} indicador(es)
                            </p>
                            {renderAccessBadges(user)}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="inline-flex rounded-full border border-[#dce8e3] bg-[#f8fcfa] px-2.5 py-1 text-[11px] font-semibold text-[#355754]">
                            {formatJwtExpiration(user.jwt_expiration)}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="text-sm font-medium text-[#355754]">
                            {formatCreatedAt(user.created_at)}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {isProtectedAdminUser(user) ? (
                            <div className="flex justify-end">
                              <span className="inline-flex items-center rounded-[14px] border border-[#d7e4de] bg-[#f8fcfa] px-3 py-2 text-[12px] font-semibold text-[#617b77]">
                                Protegido
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="inline-flex items-center gap-2 rounded-[14px] border border-[#d8e5e0] bg-white px-3 py-2 text-[12px] font-semibold text-[#385451] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
                              >
                                <UserCog className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(user)}
                                className="inline-flex items-center gap-2 rounded-[14px] border border-[#f0d6d6] bg-white px-3 py-2 text-[12px] font-semibold text-[#b14949] transition-colors hover:border-[#c45757]/30 hover:text-[#c45757]"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-[#d7e4de] bg-[#f8fcfa] px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#2e7675] shadow-[0_10px_30px_rgba(46,118,117,0.12)]">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-dashboard-display text-[1.3rem] font-bold text-[#203735]">
                Nenhum usuario encontrado
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[#5b7672]">
                Ajuste os filtros ou crie um novo usuario para comecar a montar
                a base de acessos do painel.
              </p>
            </div>
          )}
        </section>
      </div>

      {showAddModal ? (
        <UserFormModal
          title="Criar novo usuario"
          submitLabel="Criar usuario"
          isLoading={isSubmitting}
          error={modalError}
          services={allServices}
          username={newUsername}
          setUsername={setNewUsername}
          password={newPassword}
          setPassword={setNewPassword}
          isAdmin={newIsAdmin}
          setIsAdmin={setNewIsAdmin}
          endlessJwt={newEndlessJwt}
          setEndlessJwt={setNewEndlessJwt}
          selectedServiceIds={newSelectedServiceIds}
          onToggleService={toggleNewService}
          onSubmit={handleAddUser}
          onClose={closeAllModals}
          passwordPlaceholder="Informe a senha inicial"
        />
      ) : null}

      {showEditModal && currentUser ? (
        <UserFormModal
          title="Editar usuario"
          submitLabel="Salvar alteracoes"
          isLoading={isSubmitting}
          error={modalError}
          services={allServices}
          username={currentUser.username}
          isUsernameDisabled
          password={editPassword}
          setPassword={setEditPassword}
          isAdmin={editIsAdmin}
          setIsAdmin={setEditIsAdmin}
          endlessJwt={editEndlessJwt}
          setEndlessJwt={setEditEndlessJwt}
          selectedServiceIds={editSelectedServiceIds}
          onToggleService={toggleEditService}
          onSubmit={handleEditUser}
          onClose={closeAllModals}
          passwordPlaceholder={
            currentUser.is_tasy
              ? "Campo opcional para manutencao interna"
              : "Preencha apenas se desejar alterar"
          }
          isTasyUser={Boolean(currentUser.is_tasy)}
        />
      ) : null}

      {showDeleteModal && currentUser ? (
        <ConfirmDeleteModal
          user={currentUser}
          error={modalError}
          isLoading={isSubmitting}
          onConfirm={handleDeleteUser}
          onClose={closeAllModals}
        />
      ) : null}
    </div>
  );
}
