import api from "./axios";
import type { ServiceCategory } from "../features/indicators";

interface ApiListResponse<T> {
  message: string;
  content: T[];
}

interface NextServiceIdResponse {
  message: string;
  next_service_id: number;
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

export const getNextServiceId = async (): Promise<NextServiceIdResponse> => {
  const res = await api.get("api_gateway/v1/services/next-id/");
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

export const addServiceFavorite = async (id: number) => {
  const res = await api.post(`api_gateway/v1/services/${id}/favorite`);
  return res.data;
};

export const removeServiceFavorite = async (id: number) => {
  const res = await api.delete(`api_gateway/v1/services/${id}/favorite`);
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

export type NginxProgressStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export interface NginxProgressStep {
  id: string;
  label: string;
  status: NginxProgressStatus;
  output?: string;
}

export interface NginxDeploymentResult {
  status_label: "passed" | "failed";
  message: string;
  conf_id?: number;
  restored_from?: number | null;
  remote_path?: string;
  deployment?: {
    deployed: boolean;
    rolled_back: boolean;
    rollback_status: boolean;
    backup_path?: string | null;
    output?: string;
    steps?: NginxProgressStep[];
  };
}

interface NginxStreamEvent {
  type: "step" | "complete";
  step?: NginxProgressStep;
  ok?: boolean;
  result?: NginxDeploymentResult;
}

const buildApiUrl = (path: string) => {
  const baseUrl = String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
};

const requestNginxStream = async (
  path: string,
  body: Record<string, unknown>,
  onStep: (step: NginxProgressStep) => void,
): Promise<NginxDeploymentResult> => {
  const accessToken = localStorage.getItem("access_token");
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      errorPayload?.detail || errorPayload?.message || "Falha na operação NGINX.",
    );
  }
  if (!response.body) {
    throw new Error("O navegador não recebeu o fluxo de progresso.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: NginxDeploymentResult | null = null;

  const processLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as NginxStreamEvent;
    if (event.type === "step" && event.step) {
      onStep(event.step);
    }
    if (event.type === "complete" && event.result) {
      finalResult = event.result;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
    if (done) break;
  }
  processLine(buffer);

  if (!finalResult) {
    throw new Error("A publicação terminou sem um resultado final.");
  }
  return finalResult;
};

export const deployNginxConfigStream = (
  config: string,
  onStep: (step: NginxProgressStep) => void,
) =>
  requestNginxStream(
    "api_gateway/v1/nginx/deploy/stream/",
    { config },
    onStep,
  );

export const restoreNginxConfigStream = (
  onStep: (step: NginxProgressStep) => void,
) =>
  requestNginxStream(
    "api_gateway/v1/nginx/restore/stream/",
    {},
    onStep,
  );
