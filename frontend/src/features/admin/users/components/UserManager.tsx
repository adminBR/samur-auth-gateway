/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, FormEvent, useRef, useEffect } from "react";
import {
  getAllUsersAdmin,
  createUserAdmin,
  updateUserAdmin,
  deleteUserAdmin,
  getAllServicesForAdmin,
  User,
  NewUserPayload,
  UpdateUserPayload,
  AdminService,
} from "../../../../api/axios"; // Adjust path

import {
  LoaderCircle,
  X,
  Trash2,
  Edit,
  UserPlus,
  AlertTriangle,
  Check,
} from "lucide-react";

interface UserManagerProps {
  onClose: () => void; // Callback to close the modal
}

const UserManager: React.FC<UserManagerProps> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<AdminService[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true to load data
  const [isLoadingPost, setIsLoadingPost] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);

  // Modal states for internal forms
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [showEditUserModal, setShowEditUserModal] = useState<boolean>(false);
  const [currentUserToEdit, setCurrentUserToEdit] = useState<User | null>(null);

  // Add User Form Fields
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newEndlessJwt, setNewEndlessJwt] = useState(false);
  // const [newAccess, setNewAccess] = useState(""); // No longer needed, replaced by newSelectedServiceIds
  const [newSelectedServiceIds, setNewSelectedServiceIds] = useState<
    Set<number>
  >(new Set()); // ADDED: State for new user's service selection

  // Edit User Form Fields
  const [editPassword, setEditPassword] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editEndlessJwt, setEditEndlessJwt] = useState(false);
  const [editSelectedServiceIds, setEditSelectedServiceIds] = useState<
    Set<number>
  >(new Set());

  // Reference for the main modal scrollable area
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Effect to check admin status and fetch initial data
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin");
    if (adminStatus === "true") {
      setIsAdminUser(true);
      // Fetch data only if admin
      const fetchData = async () => {
        setIsLoading(true);
        setError(null); // Clear previous errors before fetching
        try {
          // Fetch services first as they are needed for both add/edit forms
          await fetchAllServices();
          await fetchUsers();
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsAdminUser(false);
      setError(
        "Acesso negado. You must be an administrator to view this page."
      );
      setIsLoading(false); // Not loading if not admin
    }
  }, []);

  const fetchUsers = async () => {
    // setError(null); // setError is handled by caller or handleApiError
    try {
      const data = await getAllUsersAdmin();
      setUsers(data);
    } catch (err: any) {
      handleApiError(err, "Failed to fetch users.");
    }
  };

  const fetchAllServices = async () => {
    // setError(null);
    try {
      const servicesData = await getAllServicesForAdmin();
      setAllServices(servicesData);
    } catch (err) {
      handleApiError(err, "Failed to fetch services list.");
      setAllServices([]); // Ensure allServices is an empty array on failure to prevent map errors
    }
  };

  const handleApiError = (err: any, defaultMessage: string) => {
    const errorMessage =
      err.response?.data?.detail || err.message || defaultMessage;
    setError(errorMessage);
    console.error(defaultMessage, err);
  };

  const resetAddUserForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewIsAdmin(false);
    setNewEndlessJwt(false);
    // setNewAccess(""); // No longer needed
    setNewSelectedServiceIds(new Set()); // ADDED: Reset selected services for new user
    setError(null); // Clear form-specific errors
  };

  // ADDED: Handler for new user service checkbox change
  const handleNewServiceCheckboxChange = (serviceId: number) => {
    setNewSelectedServiceIds((prevSelectedIds) => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(serviceId)) {
        newSelectedIds.delete(serviceId);
      } else {
        newSelectedIds.add(serviceId);
      }
      return newSelectedIds;
    });
  };

  const handleAddUser = async (e: FormEvent) => {
    setIsLoadingPost(true);
    e.preventDefault();
    setError(null);
    if (!newUsername.trim() || !newPassword.trim()) {
      setError("Username and Password are required for new user.");
      return;
    }
    const payload: NewUserPayload = {
      user_name: newUsername,
      user_pass: newPassword,
      is_admin: newIsAdmin,
      jwt_expiration: newEndlessJwt ? "inf" : "1",
      access: Array.from(newSelectedServiceIds).join(","), // MODIFIED: Use newSelectedServiceIds
    };
    try {
      await createUserAdmin(payload);
      fetchUsers();
      setShowAddUserModal(false);
      resetAddUserForm();
    } catch (err: any) {
      handleApiError(err, "Failed to add user.");
    } finally {
      setIsLoadingPost(false);
    }
  };

  const openEditModal = (user: User) => {
    setCurrentUserToEdit(user);
    setEditPassword(""); // Clear password field
    setEditIsAdmin(user.is_admin);
    setEditEndlessJwt(user.jwt_expiration === "1" ? false : true);
    const serviceIds = user.access
      ? user.access
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id))
      : [];

    setEditSelectedServiceIds(new Set(serviceIds));
    setShowEditUserModal(true);
    setError(null);
  };

  const handleServiceCheckboxChange = (serviceId: number) => {
    setEditSelectedServiceIds((prevSelectedIds) => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(serviceId)) {
        newSelectedIds.delete(serviceId);
      } else {
        newSelectedIds.add(serviceId);
      }
      return newSelectedIds;
    });
  };

  const handleEditUser = async (e: FormEvent) => {
    setIsLoadingPost(true);
    e.preventDefault();
    if (!currentUserToEdit) return;
    setError(null);

    const payload: UpdateUserPayload = {
      is_admin: editIsAdmin,
      jwt_expiration: editEndlessJwt ? "inf" : "1",
      access: Array.from(editSelectedServiceIds).join(","),
    };
    if (editPassword.trim()) {
      payload.user_pass = editPassword;
    }

    const originalAccessSet = new Set(
      currentUserToEdit.access
        ? currentUserToEdit.access
            .split(",")
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => !isNaN(id)) // ensure only numbers are processed
        : []
    );

    const noPasswordChange = !payload.user_pass;
    const noAdminChange = editIsAdmin === currentUserToEdit.is_admin;

    const noEndlessJwtChange =
      (editEndlessJwt ? "inf" : "1") === currentUserToEdit.jwt_expiration;

    const noAccessChange =
      editSelectedServiceIds.size === originalAccessSet.size &&
      Array.from(editSelectedServiceIds).every((id) =>
        originalAccessSet.has(id)
      );
    console.log(
      noPasswordChange,
      noAdminChange,
      noAccessChange,
      noEndlessJwtChange
    );

    if (
      noPasswordChange &&
      noAdminChange &&
      noAccessChange &&
      noEndlessJwtChange
    ) {
      setIsLoadingPost(false);
      setError("Nenhuma mudança foi feita...");
      return;
    }

    try {
      await updateUserAdmin(currentUserToEdit.id, payload);
      fetchUsers();
      setShowEditUserModal(false);
      setCurrentUserToEdit(null);
    } catch (err: any) {
      handleApiError(err, "Failed to update user.");
    } finally {
      setIsLoadingPost(false);
    }
  };

  // Custom Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  const handleDeleteUser = async (userId: number) => {
    setConfirmMessage(
      "Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita."
    );
    setConfirmAction(() => async () => {
      setError(null);
      try {
        await deleteUserAdmin(userId);
        fetchUsers();
      } catch (err: any) {
        handleApiError(err, "Failed to delete user.");
      }
      setShowConfirmModal(false); // Close confirmation modal after action
    });
    setShowConfirmModal(true);
  };

  const renderConfirmModal = () => {
    if (!showConfirmModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex justify-center items-center z-[70] p-4">
        <div className="relative mx-auto p-6 border-0 w-full max-w-sm shadow-2xl rounded-2xl bg-white">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="bg-red-100 p-3 rounded-full mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg leading-6 font-bold text-gray-900">
              Confirmar Ação
            </h3>
          </div>
          <p className="text-sm text-gray-500 mb-6 text-center">
            {confirmMessage}
          </p>
          {error && (
            <div
              className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded relative mb-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => {
                setShowConfirmModal(false);
                setError(null); // Clear error when cancelling
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (confirmAction) confirmAction();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSubModal = (
    title: string,
    content: JSX.Element,
    subModalCloseHandler: () => void
  ) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex justify-center items-center z-[60] p-4">
      <div className="relative mx-auto bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={subModalCloseHandler}
            className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {error && (showAddUserModal || showEditUserModal) && (
            <div
              className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded relative mb-4 text-sm flex items-center"
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}
          {content}
        </div>
      </div>
    </div>
  );

  // MODIFIED: addUserFormContent to include service selection
  const addUserFormContent = (
    <form onSubmit={handleAddUser} className="space-y-4">
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          htmlFor="newUsername"
        >
          Usuário
        </label>
        <input
          type="text"
          id="newUsername"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          required
          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          htmlFor="newPassword"
        >
          Senha
        </label>
        <input
          type="password"
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
        />
      </div>
      <div className="flex items-center gap-6 py-1">
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            id="newIsAdmin"
            checked={newIsAdmin}
            onChange={(e) => setNewIsAdmin(e.target.checked)}
            className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
          />
          <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
            É Admin?
          </span>
        </label>
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            id="newEndlessJwt"
            checked={newEndlessJwt}
            onChange={(e) => setNewEndlessJwt(e.target.checked)}
            className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
          />
          <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
            Sessão infinita?
          </span>
        </label>
      </div>
      {/* ADDED: Service Access Rights selection for Add User form */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Direitos de acesso
        </label>
        <div className="mt-1 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2 custom-scrollbar">
          {allServices.length > 0 ? (
            allServices.map((service) => (
              <div
                key={`new-service-${service.srv_id}`}
                className="flex items-center"
              >
                <input
                  id={`new-service-add-${service.srv_id}`}
                  type="checkbox"
                  checked={newSelectedServiceIds.has(service.srv_id)}
                  onChange={() =>
                    handleNewServiceCheckboxChange(service.srv_id)
                  }
                  className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
                />
                <label
                  htmlFor={`new-service-add-${service.srv_id}`}
                  className="ml-2 block text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                >
                  {service.srv_name}{" "}
                  <span className="text-xs text-gray-400">
                    (ID: {service.srv_id})
                  </span>
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">
              {isLoading
                ? "Carregando serviços..."
                : "Nenhum serviço disponível."}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={() => {
            setShowAddUserModal(false);
            resetAddUserForm();
          }}
          className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
        >
          {isLoadingPost ? (
            <LoaderCircle className="animate-spin w-5 h-5 text-white" />
          ) : (
            <p>Criar usuário</p>
          )}
        </button>
      </div>
    </form>
  );

  const editUserFormContent = currentUserToEdit && (
    <form onSubmit={handleEditUser} className="space-y-4">
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          htmlFor="editPassword"
        >
          Nova senha (opcional)
        </label>
        <input
          type="password"
          id="editPassword"
          value={editPassword}
          onChange={(e) => setEditPassword(e.target.value)}
          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#2e7675] focus:border-transparent sm:text-sm transition-shadow"
          autoComplete="new-password"
          placeholder="Deixe em branco para manter"
        />
      </div>
      <div className="flex items-center gap-6 py-1">
        <label className="flex items-center cursor-pointer group">
          <input
            id="editIsAdmin"
            type="checkbox"
            checked={editIsAdmin}
            onChange={(e) => setEditIsAdmin(e.target.checked)}
            className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
          />
          <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
            É Admin?
          </span>
        </label>
        <label className="flex items-center cursor-pointer group">
          <input
            id="jwt_expiration"
            type="checkbox"
            checked={editEndlessJwt}
            onChange={(e) => setEditEndlessJwt(e.target.checked)}
            className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
          />
          <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
            Sessão infinita
          </span>
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Direito de acesso
        </label>
        <div className="mt-1 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2 custom-scrollbar">
          {allServices.length > 0 ? (
            allServices.map((service) => (
              <div
                key={`edit-service-${service.srv_id}`}
                className="flex items-center"
              >
                <input
                  id={`service-edit-${service.srv_id}`}
                  type="checkbox"
                  checked={editSelectedServiceIds.has(service.srv_id)}
                  onChange={() => handleServiceCheckboxChange(service.srv_id)}
                  className="h-4 w-4 text-[#2e7675] border-gray-300 rounded focus:ring-[#2e7675] cursor-pointer"
                />
                <label
                  htmlFor={`service-edit-${service.srv_id}`}
                  className="ml-2 block text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                >
                  {service.srv_name}{" "}
                  <span className="text-xs text-gray-400">
                    (ID: {service.srv_id})
                  </span>
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">
              {isLoading
                ? "Carregando serviços..."
                : "Nenhum serviço disponível."}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={() => {
            setShowEditUserModal(false);
            setError(null); // Clear error when cancelling edit
          }}
          className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#2e7675] hover:bg-[#256160] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675] transition-colors"
        >
          {isLoadingPost ? (
            <LoaderCircle className="animate-spin w-5 h-5 text-white" />
          ) : (
            <p>Salvar mudanças</p>
          )}
        </button>
      </div>
    </form>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="userManagerModalTitle"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h1
            id="userManagerModalTitle"
            className="text-xl font-bold text-gray-900"
          >
            Gerenciamento de usuários
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close user manager"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div
          ref={modalBodyRef}
          className="p-6 overflow-y-auto flex-grow bg-gray-50/50"
        >
          {!isAdminUser && !isLoading && (
            <div
              className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg flex items-center"
              role="alert"
            >
              <AlertTriangle className="h-5 w-5 mr-3" />
              <div>
                <p className="font-bold">Acesso Negado</p>
                <p>
                  {error ||
                    "Você precisa ser um administrador para usar este recurso."}
                </p>
              </div>
            </div>
          )}

          {isAdminUser && (
            <>
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <LoaderCircle className="w-10 h-10 animate-spin text-[#2e7675] mb-3" />
                  <p>Carregando dados...</p>
                </div>
              )}

              {error &&
                !showAddUserModal &&
                !showEditUserModal &&
                !showConfirmModal &&
                !isLoading && (
                  <div
                    className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded relative mb-4 text-sm flex items-center"
                    role="alert"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {error}
                  </div>
                )}

              {!isLoading && (
                <>
                  <div className="mb-6 flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                      Total de usuários:{" "}
                      <span className="font-semibold text-gray-900">
                        {users.length}
                      </span>
                    </p>
                    <button
                      onClick={() => {
                        setError(null); // Clear any previous main errors
                        resetAddUserForm(); // Reset form fields and specific errors
                        setShowAddUserModal(true);
                      }}
                      className="inline-flex items-center gap-2 bg-[#2e7675] hover:bg-[#256160] text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2e7675]"
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar usuário
                    </button>
                  </div>

                  {users.length === 0 && !error && !isLoading && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500">
                        Nenhum usuário encontrado.
                      </p>
                    </div>
                  )}

                  {users.length > 0 && (
                    <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-xl bg-white">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              ID
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Usuário
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Admin
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Expiração JWT
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Acesso (IDs)
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Criado em
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {users.map((user) => (
                            <tr
                              key={user.id}
                              className="hover:bg-gray-50 transition-colors duration-150"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {user.username}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {user.is_admin ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Check className="w-3 h-3 mr-1" /> Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Não
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {user.jwt_expiration === "inf"
                                  ? "Infinito"
                                  : "Padrão"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div
                                  className="truncate max-w-[150px]"
                                  title={user.access || "Nenhum"}
                                >
                                  {user.access || "-"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.created_at
                                  ? new Date(
                                      user.created_at
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-3">
                                  <button
                                    onClick={() => {
                                      setError(null); // Clear main error
                                      openEditModal(user);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 transition-colors p-1 rounded hover:bg-indigo-50"
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setError(null); // Clear main error
                                      handleDeleteUser(user.id);
                                    }}
                                    className="text-red-600 hover:text-red-900 transition-colors p-1 rounded hover:bg-red-50"
                                    title="Remover"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showAddUserModal &&
        renderSubModal("Adicionar novo usuário", addUserFormContent, () => {
          setShowAddUserModal(false);
          resetAddUserForm(); // Also clears sub-modal error
        })}
      {showEditUserModal &&
        currentUserToEdit &&
        renderSubModal(
          `Editar Usuário: ${currentUserToEdit.username}`,
          editUserFormContent || <div />, // Fallback if editUserFormContent is null
          () => {
            setShowEditUserModal(false);
            setError(null); // Clear sub-modal error
            setCurrentUserToEdit(null); // Clear current user being edited
          }
        )}
      {renderConfirmModal()}
    </div>
  );
};

export default UserManager;
