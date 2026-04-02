import api from "./axios";

export interface AnalyticsDetailRow {
  user_id: string;
  user_name: string;
  client_ip: string;
  access_count: number;
}

export interface AnalyticsBucket {
  bucket_start: string;
  count: number;
  details: AnalyticsDetailRow[];
}

export interface ServiceAnalyticsSeries {
  service_id: number;
  service_name: string;
  total_count: number;
  buckets: AnalyticsBucket[];
}

export interface AuthAnalyticsResponse {
  start: string;
  end: string;
  global: {
    total_count: number;
    buckets: AnalyticsBucket[];
  };
  services: ServiceAnalyticsSeries[];
}

export const getAuthAnalytics = async (
  start: string,
  end: string,
): Promise<AuthAnalyticsResponse> => {
  const res = await api.get("api_gateway/v1/analytics/auth-access/", {
    params: { start, end },
  });

  return res.data;
};

