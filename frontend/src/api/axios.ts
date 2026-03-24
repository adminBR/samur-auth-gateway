import axios, { type InternalAxiosRequestConfig } from "axios";
import { buildLoginRedirectPath } from "../utils/redirect";
import type { IndicatorCategory } from "../features/indicators";

export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  access: string;
  created_at?: string;
  jwt_expiration: string;
}

export interface NewUserPayload {
  user_name: string;
  user_pass: string;
  is_admin?: boolean;
  access?: string;
  jwt_expiration: string;
}

export interface UpdateUserPayload {
  user_pass?: string;
  is_admin?: boolean;
  access?: string;
  jwt_expiration: string;
}

export interface AdminService {
  srv_id: number;
  srv_name: string;
  srv_desc?: string;
  srv_category: IndicatorCategory;
}

interface AuthRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthHeader?: boolean;
  skipAuthRefresh?: boolean;
  skipAuthRedirect?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL;
const ACCESS_TOKEN_STORAGE_KEY = "access_token";
const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
  withCredentials: true,
});

const authClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

const clearStoredAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem("isAdmin");
};

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const res = await authClient.post("api_gateway/v1/users/refresh/", {});
    const accessToken = res.data?.access_token;

    if (!accessToken) {
      return null;
    }

    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    return accessToken;
  } catch {
    return null;
  }
};

api.interceptors.request.use(
  (config) => {
    const requestConfig = config as AuthRequestConfig;

    if (requestConfig.skipAuthHeader) {
      if (requestConfig.headers) {
        delete requestConfig.headers.Authorization;
      }
      return requestConfig;
    }

    const token = getAccessToken();
    if (token) {
      requestConfig.headers = requestConfig.headers ?? {};
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }

    return requestConfig;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AuthRequestConfig | undefined;
    const status = error.response?.status;

    if (!originalRequest || !status) {
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh
    ) {
      originalRequest._retry = true;
      const refreshedAccessToken = await refreshAccessToken();

      if (refreshedAccessToken) {
        if (!originalRequest.skipAuthHeader) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${refreshedAccessToken}`;
        }

        return api(originalRequest);
      }
    }

    if ([401, 403].includes(status) && !originalRequest.skipAuthRedirect) {
      clearStoredAuth();
      window.location.href = buildLoginRedirectPath();
    }

    return Promise.reject(error);
  },
);

export const loginUser = async (user_name: string, user_pass: string) => {
  const res = await api.post(
    "api_gateway/v1/users/login/",
    { user_name, user_pass },
    {
      skipAuthHeader: true,
      skipAuthRefresh: true,
      skipAuthRedirect: true,
    } as AuthRequestConfig,
  );

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, res.data.access_token);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.setItem("isAdmin", String(res.data.isAdmin));

  return res.data;
};

export const validateToken = async () => {
  try {
    const res = await api.get("api_gateway/v1/users/validate", {
      skipAuthHeader: true,
      skipAuthRefresh: true,
      skipAuthRedirect: true,
    } as AuthRequestConfig);
    return res.data;
  } catch {
    return { valid: false };
  }
};

export const logoutUser = async () => {
  try {
    await api.get("api_gateway/v1/users/logout", {
      skipAuthHeader: true,
      skipAuthRefresh: true,
      skipAuthRedirect: true,
    } as AuthRequestConfig);
    clearStoredAuth();
    return true;
  } catch {
    clearStoredAuth();
    return false;
  }
};

export const getAllUsersAdmin = async (): Promise<User[]> => {
  const res = await api.get("api_gateway/v1/users/admin/");
  return res.data;
};

export const createUserAdmin = async (
  userData: NewUserPayload,
): Promise<{ response: string; user: User }> => {
  const res = await api.post("api_gateway/v1/users/admin/", userData);
  return res.data;
};

export const getUserDetailsAdmin = async (userId: number): Promise<User> => {
  const res = await api.get(`api_gateway/v1/users/admin/${userId}/`);
  return res.data;
};

export const updateUserAdmin = async (
  userId: number,
  userData: UpdateUserPayload,
): Promise<{ response: string; user: User }> => {
  const res = await api.put(`api_gateway/v1/users/admin/${userId}/`, userData);
  return res.data;
};

export const deleteUserAdmin = async (
  userId: number,
): Promise<{ response: string }> => {
  const res = await api.delete(`api_gateway/v1/users/admin/${userId}/`);
  return res.data;
};

export const getAllServicesForAdmin = async (): Promise<AdminService[]> => {
  const res = await api.get("api_gateway/v1/users/admin/services/all/");
  return res.data;
};

export interface MeResponse {
  user_id: number;
  user_name: string;
  is_admin: boolean;
}

export const getMe = async (): Promise<MeResponse> => {
  const res = await api.get("api_gateway/v1/users/me/", {
    skipAuthHeader: true,
  } as AuthRequestConfig);
  return res.data;
};

export default api;
