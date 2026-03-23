import { type IndicatorCategory } from "../../indicators/config/serviceCategories";
import type { IndicatorCategoryGroup } from "../types";

interface MobileCategoryTabsProps {
  categoryGroups: IndicatorCategoryGroup[];
  activeCategory: IndicatorCategory | null;
  onSelectCategory: (category: IndicatorCategory) => void;
}

export function MobileCategoryTabs({
  categoryGroups,
  activeCategory,
  onSelectCategory,
}: MobileCategoryTabsProps) {
  return (
    <div className="sticky top-[86px] z-30 -mx-2 mb-3 flex gap-2 overflow-x-auto px-2 py-1 sm:-mx-3 sm:px-3 lg:hidden">
      {categoryGroups.map((category) => {
        const isActive = category.value === activeCategory;

        return (
          <button
            key={category.value}
            onClick={() => onSelectCategory(category.value)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
              isActive
                ? "border-[#2e7675]/20 bg-white text-[#2e7675] shadow-[0_14px_24px_rgba(46,118,117,0.14)]"
                : "border-[#dce8e3] bg-white text-gray-700"
            }`}
          >
            {category.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive
                  ? "bg-[#2e7675]/8 text-[#2e7675]"
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
