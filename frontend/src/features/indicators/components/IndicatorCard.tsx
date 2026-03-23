import { Edit, ExternalLink, Globe } from "lucide-react";
import type { IndicatorService } from "../types/indicatorService";

interface IndicatorCardProps {
  service: IndicatorService;
  imageSrc: string | null;
  isAdmin: boolean;
  onOpen: (service: IndicatorService) => void;
  onEdit: (
    event: React.MouseEvent<HTMLButtonElement>,
    service: IndicatorService,
  ) => void;
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

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,22,0.14)_0%,rgba(8,16,22,0.28)_100%)]" />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,22,0.08)_0%,rgba(8,16,22,0.42)_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(0deg,rgba(7,15,21,0.60)_0%,rgba(7,15,21,0.30)_30%,transparent_100%)] px-3 py-2">
          <div className="font-dashboard-mono flex min-w-0 items-center gap-1.5 text-[10px] font-semibold tracking-[0.04em] text-white">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate" title={service.srv_ip}>
              {service.srv_ip}
            </span>
          </div>
        </div>

        {!service.rt_enabled && (
          <div className="absolute left-2.5 top-2.5 z-10 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
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
        <h3 className="font-dashboard-display text-[13px] font-bold uppercase leading-[1.2] tracking-[0.05em] text-gray-900 transition-colors group-hover:text-[#2e7675]">
          {service.srv_name}
        </h3>

        <p className="mt-1 flex-1 text-[12px] leading-[1.35rem] text-gray-600">
          {service.srv_desc || "Sem descricao disponivel."}
        </p>
      </div>
    </article>
  );
}
