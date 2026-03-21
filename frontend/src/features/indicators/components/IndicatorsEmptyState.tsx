import { Search } from "lucide-react";

export function IndicatorsEmptyState() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white text-center shadow-sm">
      <div className="rounded-full bg-gray-50 p-4">
        <Search className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-gray-900">
        Nenhum indicador encontrado
      </h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-gray-500">
        Nao encontramos indicadores com o termo pesquisado.
      </p>
    </div>
  );
}
