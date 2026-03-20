import { ArrowLeft, Compass, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2e7675] px-4 py-6">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <section>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#2e7675]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#2e7675]">
              <Compass className="h-4 w-4" />
              Erro 404
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#2e7675]">
                Indicadores Samur
              </p>
              <h1 className="text-3xl font-black leading-tight text-gray-900 sm:text-4xl">
                Pagina nao encontrada
              </h1>
              <p className="max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
                A rota solicitada nao existe ou nao esta disponivel neste
                gateway. Use um dos atalhos para voltar ao fluxo principal.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-[#2e7675]/15 bg-[#2e7675]/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2e7675]">
                Caminho solicitado
              </p>
              <p className="mt-2 break-all font-mono text-xs text-gray-700 sm:text-sm">
                {location.pathname}
                {location.search}
                {location.hash}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2e7675] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#256160]"
              >
                <Home className="h-4 w-4" />
                Ir para o painel
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-[#2e7675]/40 hover:text-[#2e7675]"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </div>
          </section>

          <aside className="flex items-center justify-center md:justify-end">
            <div className="w-full rounded-[24px] bg-[#2e7675] px-8 py-6 text-center text-white md:w-[210px]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/20 bg-white/10 text-3xl font-black">
                404
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                Rota invalida
              </p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                Revise o endereco e tente novamente.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
