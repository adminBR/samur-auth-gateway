import type { DashboardSectionId } from "../../dashboard/types";
import type { IndicatorService } from "../types/indicatorService";
import { IndicatorCard } from "./IndicatorCard";

interface IndicatorModuleSectionProps {
  category: {
    value: DashboardSectionId;
    label: string;
  };
  count: number;
  services: IndicatorService[];
  isAdmin: boolean;
  isActive: boolean;
  sectionRef: (node: HTMLElement | null) => void;
  getServiceImageSrc: (service: IndicatorService) => string | null;
  onOpenIndicator: (service: IndicatorService) => void;
  onToggleFavorite: (service: IndicatorService) => void;
  favoriteLoadingId: number | null;
  onEditIndicator: (
    event: React.MouseEvent<HTMLButtonElement>,
    service: IndicatorService,
  ) => void;
}

export function IndicatorModuleSection({
  category,
  count,
  services,
  isAdmin,
  isActive,
  sectionRef,
  getServiceImageSrc,
  onOpenIndicator,
  onToggleFavorite,
  favoriteLoadingId,
  onEditIndicator,
}: IndicatorModuleSectionProps) {
  return (
    <section
      ref={sectionRef}
      className={`relative min-h-[calc(100vh-7rem)] scroll-mt-28 overflow-visible rounded-[28px] border px-5 py-5 shadow-[0_18px_36px_rgba(15,23,42,0.05)] transition-all duration-300 sm:px-6 sm:py-6 ${
        isActive
          ? "border-[#d6e7e2] bg-white/92"
          : "border-white/80 bg-white/74"
      }`}
    >
      <div className="mb-4 flex flex-col gap-2 border-b border-[#dce8e3] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-dashboard-display text-[1.02rem] font-bold uppercase tracking-[0.08em] text-[#183938] sm:text-[1.14rem]">
            {category.label}
          </h2>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 sm:text-xs">
          {count} item{count === 1 ? "" : "s"}
        </p>
      </div>

      {services.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => (
            <IndicatorCard
              key={service.srv_id}
              service={service}
              imageSrc={getServiceImageSrc(service)}
              isAdmin={isAdmin}
              onOpen={onOpenIndicator}
              onToggleFavorite={onToggleFavorite}
              isFavoriteLoading={favoriteLoadingId === service.srv_id}
              onEdit={onEditIndicator}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500 shadow-sm">
          Nenhum indicador nesta categoria.
        </div>
      )}
    </section>
  );
}
