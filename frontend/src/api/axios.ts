// api/axios.ts
import axios from "axios";

// --- Types for User Management ---
export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  access: string;
  created_at?: string; // Optional, as it might not always be needed/returned
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
  user_pass?: string; // Password is optional on update
  is_admin?: boolean;
  access?: string;
  jwt_expiration: string;
}

export interface AdminService {
  srv_id: number;
  srv_name: string;
  srv_desc?: string;
}

//const API_BASE_URL = "http://192.168.1.64";
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Create an Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
});

// Helper to get tokens from localStorage
const getAccessToken = () => localStorage.getItem("access_token");
//const getRefreshToken = () => localStorage.getItem("refresh_token");

// Attach access token to each request
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    //const originalRequest = error.config;
    // Any prohibited or unauthorized request will send the user back to login
    if ([401, 403].includes(error.response?.status)) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    /*if (error.response?.status === 401 && !originalRequest._retry) {
      console.log()
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
          return Promise.reject(error);
        }
        const res = await axios.post(`api/token/refresh/`, {
          refresh_token: refreshToken,
        });

        const { access_token } = res.data;
        localStorage.setItem("access_token", access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }*/

    return Promise.reject(error);
  }
);

export const loginUser = async (user_name: string, user_pass: string) => {
  const body = {
    user_name: user_name,
    user_pass: user_pass,
  };
  console.log(body);
  const res = await api.post("api/v1/users/login/", body,{ withCredentials: true,});

  localStorage.setItem("access_token", res.data.access_token);
  localStorage.setItem("refresh_token", res.data.refresh_token);
  localStorage.setItem("isAdmin", res.data.isAdmin);

  return res.data;
};

export const validateToken = async () => {
  try {
    const res = await api.get("api/v1/users/validate");
    return res.data; // { valid: true, user_id, user_name }
  } catch {
    return { valid: false };
  }
};

export const logoutUser = async () => {
  try {
    await api.get("api/v1/users/logout");
    return true;
  } catch {
    return false;
  }
};

// --- Admin User Management API Calls ---

export const getAllUsersAdmin = async (): Promise<User[]> => {
  const res = await api.get("api/v1/users/admin/"); // Adjust path if needed
  return res.data;
};

export const createUserAdmin = async (
  userData: NewUserPayload
): Promise<{ response: string; user: User }> => {
  const res = await api.post("api/v1/users/admin/", userData); // Adjust path
  return res.data;
};

export const getUserDetailsAdmin = async (userId: number): Promise<User> => {
  const res = await api.get(`api/v1/users/admin/${userId}/`); // Adjust path
  return res.data;
};

export const updateUserAdmin = async (
  userId: number,
  userData: UpdateUserPayload
): Promise<{ response: string; user: User }> => {
  const res = await api.put(`api/v1/users/admin/${userId}/`, userData); // Adjust path
  return res.data;
};

export const deleteUserAdmin = async (
  userId: number
): Promise<{ response: string }> => {
  const res = await api.delete(`api/v1/users/admin/${userId}/`); // Adjust path
  return res.data;
};

export const getAllServicesForAdmin = async (): Promise<AdminService[]> => {
  const res = await api.get("api/v1/users/admin/services/all/"); // Adjust path to match your Django urls.py
  return res.data;
};

export default api;
