import {
  normalizeIndicatorCategory,
  type IndicatorCategory,
} from "../config/serviceCategories";
import type {
  EditableIndicatorService,
  IndicatorService,
} from "../types/indicatorService";

export const normalizeService = (
  service: Omit<IndicatorService, "srv_category"> & {
    srv_category?: number | string | null;
  },
): IndicatorService => ({
  ...service,
  srv_category: normalizeIndicatorCategory(service.srv_category),
  is_favorite: Boolean(service.is_favorite),
  rt_enabled: service.rt_enabled ?? true,
});

export const buildDefaultIndicator = (
  category: IndicatorCategory = 0,
): EditableIndicatorService => ({
  srv_image: "/api/placeholder/200/150",
  srv_name: "",
  srv_ip: "",
  srv_desc: "",
  srv_category: category,
  rt_frontend_block: "",
  rt_backend_block: "",
  rt_enabled: true,
});
