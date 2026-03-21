import { type IndicatorCategory } from "../../indicators/config/serviceCategories";
import type { IndicatorCategoryGroup } from "../types";

interface DashboardSidebarProps {
  categoryGroups: IndicatorCategoryGroup[];
  activeCategory: IndicatorCategory;
  onSelectCategory: (category: IndicatorCategory) => void;
}

export function DashboardSidebar({
  categoryGroups,
  activeCategory,
  onSelectCategory,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden w-[236px] shrink-0 lg:block">
      <div className="sticky top-4">
        <div className="rounded-[28px] border border-white bg-[#f6faf9] p-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="rounded-[22px] border border-[#d7e6e3] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2e7675] shadow-[0_12px_24px_rgba(46,118,117,0.2)]">
                <img
                  src="/logo-white.webp"
                  alt="Indicadores"
                  className="h-auto w-7 object-contain"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e7675]">
                  Navegacao
                </p>
                <p className="text-base font-black text-gray-900">Indicadores</p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {categoryGroups.map((category) => {
              const isActive = category.value === activeCategory;

              return (
                <button
                  key={category.value}
                  onClick={() => onSelectCategory(category.value)}
                  className={`group relative w-full overflow-hidden rounded-[22px] border px-4 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? "border-[#2e7675]/15 bg-[#2e7675] text-white shadow-[0_16px_28px_rgba(46,118,117,0.22)]"
                      : "border-transparent bg-white text-gray-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-[#2e7675]/10 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                  }`}
                >
                  <span
                    className={`absolute inset-y-3 left-2 w-1 rounded-full transition-all duration-300 ${
                      isActive
                        ? "bg-white/85"
                        : "bg-[#2e7675]/14 opacity-0 group-hover:opacity-100"
                    }`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                        Modulo
                      </p>
                      <p className="mt-1 text-sm font-bold tracking-[0.02em]">
                        {category.label}
                      </p>
                    </div>
                    <div
                      className={`inline-flex min-w-[42px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                        isActive
                          ? "bg-white/16 text-white"
                          : "bg-[#2e7675]/8 text-[#2e7675]"
                      }`}
                    >
                      {category.count}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
