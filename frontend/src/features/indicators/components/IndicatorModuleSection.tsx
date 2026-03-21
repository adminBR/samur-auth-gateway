import type { IndicatorCategory } from "../config/serviceCategories";
import type { IndicatorService } from "../types/indicatorService";
import { IndicatorCard } from "./IndicatorCard";

interface IndicatorModuleSectionProps {
  category: {
    value: IndicatorCategory;
    label: string;
  };
  count: number;
  services: IndicatorService[];
  isAdmin: boolean;
  sectionRef: (node: HTMLElement | null) => void;
  getServiceImageSrc: (service: IndicatorService) => string | null;
  onOpenIndicator: (service: IndicatorService) => void;
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
  sectionRef,
  getServiceImageSrc,
  onOpenIndicator,
  onEditIndicator,
}: IndicatorModuleSectionProps) {
  return (
    <section
      ref={sectionRef}
      className="min-h-[calc(100vh-9.5rem)] scroll-mt-32 border-b border-gray-200/90 pb-10 last:min-h-[calc(100vh-8rem)] last:border-b-0 last:pb-0"
    >
      <div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e7675]">
            Modulo
          </p>
          <h2 className="mt-1 text-[1.4rem] font-black text-gray-900 sm:text-[1.55rem]">
            {category.label}
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2e7675]/12 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2e7675]" />
          {count} indicador{count === 1 ? "" : "es"}
        </div>
      </div>

      {services.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {services.map((service) => (
            <IndicatorCard
              key={service.srv_id}
              service={service}
              imageSrc={getServiceImageSrc(service)}
              isAdmin={isAdmin}
              onOpen={onOpenIndicator}
              onEdit={onEditIndicator}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-gray-300 bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
          Nenhum indicador nesta categoria.
        </div>
      )}
    </section>
  );
}
