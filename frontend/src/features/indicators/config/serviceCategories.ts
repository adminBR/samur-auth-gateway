export type IndicatorCategory = number;

export interface ServiceCategory {
  tag_id: number;
  tag_name: string;
}

export interface IndicatorCategoryOption {
  value: IndicatorCategory;
  label: string;
}

export const normalizeIndicatorCategory = (
  value?: number | string | null,
): IndicatorCategory => {
  const categoryId = Number(value);
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : 0;
};

export const toIndicatorCategoryOption = (
  category: ServiceCategory,
): IndicatorCategoryOption => ({
  value: category.tag_id,
  label: category.tag_name,
});
