import { type IndicatorCategory } from "../../indicators/config/serviceCategories";
import type { IndicatorCategoryGroup } from "../types";

interface MobileCategoryTabsProps {
  categoryGroups: IndicatorCategoryGroup[];
  activeCategory: IndicatorCategory;
  onSelectCategory: (category: IndicatorCategory) => void;
}

export function MobileCategoryTabs({
  categoryGroups,
  activeCategory,
  onSelectCategory,
}: MobileCategoryTabsProps) {
  return (
    <div className="sticky top-[78px] z-30 -mx-3 mb-3 flex gap-2 overflow-x-auto bg-[#edf3f2] px-3 py-1 sm:-mx-4 sm:px-4 lg:hidden">
      {categoryGroups.map((category) => {
        const isActive = category.value === activeCategory;

        return (
          <button
            key={category.value}
            onClick={() => onSelectCategory(category.value)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-300 ${
              isActive
                ? "border-[#2e7675] bg-[#2e7675] text-white shadow-[0_14px_24px_rgba(46,118,117,0.22)]"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            {category.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive
                  ? "bg-white/16 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {category.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
