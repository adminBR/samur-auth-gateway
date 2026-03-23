import type { DashboardSectionId, IndicatorCategoryGroup } from "../types";

interface DashboardSidebarProps {
  categoryGroups: IndicatorCategoryGroup[];
  activeCategory: DashboardSectionId | null;
  onSelectCategory: (category: DashboardSectionId) => void;
}

export function DashboardSidebar({
  categoryGroups,
  activeCategory,
  onSelectCategory,
}: DashboardSidebarProps) {
  return (
    <aside className="sticky pt-6 top-[82px] hidden h-fit w-[152px] shrink-0 self-start lg:block">
      <div className="max-h-[calc(100vh-128px)] space-y-1 overflow-y-auto">
        {categoryGroups.map((category) => {
          const isActive = category.value === activeCategory;

          return (
            <button
              key={category.value}
              onClick={() => onSelectCategory(category.value)}
              className={`group relative w-full pl-4 pr-2 text-left uppercase transition-all duration-200 ${
                isActive
                  ? "font-dashboard-display py-2 text-[13px] font-bold tracking-[0.16em] text-[#173938]"
                  : "py-1.5 text-[10px] font-semibold tracking-[0.14em] text-gray-500 hover:text-[#214f4e]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-[#2e7675] transition-all duration-200 ${
                  isActive
                    ? "h-6 w-[3px] opacity-100 shadow-[0_0_18px_rgba(46,118,117,0.28)]"
                    : "h-0 w-[2px] opacity-0 group-hover:h-4 group-hover:opacity-50"
                }`}
              />
              <span
                className={`block transition-transform duration-200 ${
                  isActive ? "translate-x-1" : ""
                }`}
              >
                {category.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
