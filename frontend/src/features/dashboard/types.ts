import type { IndicatorCategory } from "../indicators/config/serviceCategories";
import type { IndicatorService } from "../indicators/types/indicatorService";

export const FAVORITES_SECTION_ID = "favorites" as const;

export type DashboardSectionId =
  | typeof FAVORITES_SECTION_ID
  | IndicatorCategory;

export interface IndicatorCategoryGroup {
  value: DashboardSectionId;
  label: string;
  count: number;
  services: IndicatorService[];
}
