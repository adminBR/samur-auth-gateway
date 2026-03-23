import api from "./axios";
import type { ServiceCategory } from "../features/indicators";

interface ApiListResponse<T> {
  message: string;
  content: T[];
}

export const getServices = async () => {
  const res = await api.get("api_gateway/v1/services/");
  return res.data;
};

export const getServiceCategories = async (): Promise<
  ApiListResponse<ServiceCategory>
> => {
  const res = await api.get("api_gateway/v1/services/categories/");
  return res.data;
};

export const addService = async (formData: FormData) => {
  const res = await api.post("api_gateway/v1/services/", formData);
  return res.data;
};

export const updateService = async (id: number, formData: FormData) => {
  // Transform data to match API expectations
  const res = await api.put(`api_gateway/v1/services/${id}`, formData, {
    headers: {},
  });
  return res.data;
};

export const deleteService = async (id: number) => {
  // Transform data to match API expectations
  const res = await api.delete(`api_gateway/v1/services/${id}`);
  return res.data;
};

export const getNginxConfig = async () => {
  const res = await api.get("api_gateway/v1/nginx/config/");
  return res.data;
};

export const deployNginxConfig = async (config: string) => {
  const res = await api.post("api_gateway/v1/nginx/deploy/", { config });
  return res.data;
};

export const restoreNginxConfig = async () => {
  const res = await api.post("api_gateway/v1/nginx/restore/");
  return res.data;
};
