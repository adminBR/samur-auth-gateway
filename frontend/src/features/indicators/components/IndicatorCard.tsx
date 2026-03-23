import { ChevronRight, Edit, ExternalLink, Globe } from "lucide-react";
import type { IndicatorService } from "../types/indicatorService";

interface IndicatorCardProps {
  service: IndicatorService;
  imageSrc: string | null;
  isAdmin: boolean;
  onOpen: (service: IndicatorService) => void;
  onEdit: (event: React.MouseEvent<HTMLButtonElement>, service: IndicatorService) => void;
}

export function IndicatorCard({
  service,
  imageSrc,
  isAdmin,
  onOpen,
  onEdit,
}: IndicatorCardProps) {
  return (
    <article
      onClick={() => onOpen(service)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative h-28 overflow-hidden bg-gray-100 sm:h-[7.5rem]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={service.srv_name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#2e7675]/6 text-[#2e7675]/70">
            <Globe className="h-8 w-8" />
          </div>
        )}

        <div className="absolute inset-0 bg-[#2e7675]/88 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-full items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/14 px-3 py-1.5 text-xs font-semibold text-white">
              Abrir indicador
              <ExternalLink className="h-4 w-4" />
            </span>
          </div>
        </div>

        {!service.rt_enabled && (
          <div className="absolute bottom-2.5 left-2.5 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            Indisponivel
          </div>
        )}

        {isAdmin && (
          <button
            onClick={(event) => onEdit(event, service)}
            className="absolute right-2.5 top-2.5 z-10 rounded-full bg-white p-1.5 text-gray-600 shadow-sm transition-colors hover:text-[#2e7675]"
            title="Editar indicador"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="font-dashboard-display text-[13px] font-bold uppercase leading-[1.2] tracking-[0.05em] text-gray-900 transition-colors group-hover:text-[#2e7675]">
            {service.srv_name}
          </h3>
          <ChevronRight className="mt-0.5 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#2e7675]" />
        </div>

        <p className="mt-1 flex-1 text-[12px] leading-[1.35rem] text-gray-600">
          {service.srv_desc || "Sem descricao disponivel."}
        </p>

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="font-dashboard-mono inline-flex items-center gap-1.5 rounded-full bg-[#2e7675]/8 px-2.5 py-1 text-[10px] font-medium text-[#2e7675]">
            <Globe className="h-3 w-3" />
            {service.srv_ip}
          </div>
        </div>
      </div>
    </article>
  );
}
