import type { IndicatorCategory } from "../constants/serviceCategories";

export interface IndicatorService {
  srv_id: number;
  srv_image: Base64URLString | null;
  srv_name: string;
  srv_ip: string;
  srv_desc: string;
  srv_category: IndicatorCategory;
  rt_frontend_block?: string;
  rt_backend_block?: string;
  rt_enabled?: boolean;
}

export type EditableIndicatorService = Omit<IndicatorService, "srv_id"> & {
  srv_id?: number;
};
