import api from "./axios";

export const getServices = async () => {
  const res = await api.get("api_gateway/v1/services/");
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
