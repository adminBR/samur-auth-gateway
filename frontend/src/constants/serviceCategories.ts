export const indicatorCategories = [
  {
    value: "cpoe",
    label: "CPOE",
    description: "Indicadores operacionais e assistenciais.",
  },
  {
    value: "adep",
    label: "ADEP",
    description: "Indicadores administrativos e de desempenho.",
  },
  {
    value: "farmacia",
    label: "Farmacia",
    description: "Indicadores e paineis da farmacia.",
  },
] as const;

export type IndicatorCategory = (typeof indicatorCategories)[number]["value"];

export const indicatorCategoryLabels: Record<IndicatorCategory, string> = {
  cpoe: "CPOE",
  adep: "ADEP",
  farmacia: "Farmacia",
};

export const normalizeIndicatorCategory = (
  value?: string | null,
): IndicatorCategory => {
  const category = value?.trim().toLowerCase();

  if (category === "adep" || category === "farmacia") {
    return category;
  }

  return "cpoe";
};
