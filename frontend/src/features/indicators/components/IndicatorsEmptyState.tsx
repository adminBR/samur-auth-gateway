import { Search, ShieldCheck } from "lucide-react";

interface IndicatorsEmptyStateProps {
  hasAssignedIndicators?: boolean;
}

export function IndicatorsEmptyState({
  hasAssignedIndicators = true,
}: IndicatorsEmptyStateProps) {
  if (!hasAssignedIndicators) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#b7d0c6] bg-white px-6 text-center shadow-sm">
        <div className="rounded-full bg-[#edf7f3] p-4">
          <ShieldCheck className="h-8 w-8 text-[#2e7675]" />
        </div>
        <span className="mt-5 inline-flex rounded-full border border-[#cfe3dc] bg-[#f4fbf8] px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2e7675]">
          Conta ativa
        </span>
        <h3 className="mt-4 text-xl font-semibold text-gray-900">
          Seu acesso foi ativado com sucesso
        </h3>
        <p className="mt-3 max-w-lg text-sm leading-7 text-gray-500">
          Sua conta ja esta pronta para uso, mas ainda nao existem indicadores
          liberados para o seu perfil neste portal.
        </p>
        <p className="mt-4 rounded-2xl bg-[#f7faf9] px-5 py-3 text-sm font-medium text-[#355854]">
          Entre em contato com a equipe de TI para solicitar a liberacao dos
          indicadores necessarios para o seu acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white text-center shadow-sm">
      <div className="rounded-full bg-gray-50 p-4">
        <Search className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-gray-900">
        Nenhum indicador encontrado
      </h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-gray-500">
        Nao encontramos indicadores com os filtros informados. Tente ajustar a
        pesquisa para localizar o que voce precisa.
      </p>
    </div>
  );
}
