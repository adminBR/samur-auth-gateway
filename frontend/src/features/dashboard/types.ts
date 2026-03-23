import type { IndicatorCategory } from "../indicators/config/serviceCategories";
import type { IndicatorService } from "../indicators/types/indicatorService";

export interface IndicatorCategoryGroup {
  value: IndicatorCategory;
  label: string;
  count: number;
  services: IndicatorService[];
}
