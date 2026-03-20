import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  User,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { loginUser } from "./api/axios";
import { isAuthenticated } from "./utils/auth";
import { redirectAfterLogin, sanitizeNextPath } from "./utils/redirect";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const location = useLocation();
  const nextPath = sanitizeNextPath(
    new URLSearchParams(location.search).get("next"),
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage(null);
    e.preventDefault();
    setIsLoading(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await loginUser(username, password);
        redirectAfterLogin(nextPath);
      } catch (err) {
        const error = err as {
          response?: { status?: number };
          request?: unknown;
        };

        if (error.response?.status === 401) {
          setErrorMessage("Usuario ou senha invalidos.");
        } else if (error.request && !error.response) {
          setErrorMessage(
            "Servidor indisponivel. Tente novamente em alguns minutos.",
          );
        } else {
          setErrorMessage("Nao foi possivel completar o login. Tente novamente.");
        }

        console.error("Login error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 1000);
  };

  useEffect(() => {
    const checkLogin = async () => {
      const loggedIn = await isAuthenticated();

      if (loggedIn) {
        redirectAfterLogin(nextPath);
      }
    };

    checkLogin();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nextPath]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#edf3f2]">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute -left-16 top-14 h-56 w-56 rounded-full bg-[#2e7675]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#2e7675]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,118,117,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,118,117,0.04)_1px,transparent_1px)] bg-[size:34px_34px]" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex bg-[#2e7675] px-7 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
          <div className="flex w-full max-w-xl flex-col justify-between">
            <div>
              <img
                src="/s-b.webp"
                alt="Indicadores Samur"
                className="h-auto w-full max-w-[280px] object-contain"
              />

              <div className="mt-14 max-w-md">
                <h1 className="text-4xl font-black leading-tight sm:text-[2.8rem]">
                  Portal de Indicadores
                </h1>
                <p className="mt-5 text-base leading-8 text-white/78">
                  Acesso interno para dashboards, BI, indicadores e servicos da
                  operacao.
                </p>
              </div>
            </div>

            <div className="mt-12 border-t border-white/12 pt-6">
              <p className="text-sm leading-7 text-white/68">
                Uso interno entre setores da empresa.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <img
                src="/s-b.webp"
                alt="Indicadores Samur"
                className="h-auto w-full max-w-[220px] object-contain"
              />
            </div>

            <div className="mt-6 lg:mt-0">
              <h2 className="text-[2rem] font-black tracking-tight text-gray-900 sm:text-[2.2rem]">
                Entrar
              </h2>
            </div>

            {nextPath && (
              <div className="mt-6 rounded-2xl border border-[#2e7675]/10 bg-[#2e7675]/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2e7675]">
                  Destino apos o login
                </p>
                <p className="mt-2 break-all font-mono text-xs text-gray-700">
                  {nextPath}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Usuario
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    disabled={isLoading}
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white/80 px-3 py-3 pl-10 text-gray-900 outline-none transition-all focus:border-[#2e7675]/30 focus:bg-white focus:ring-4 focus:ring-[#2e7675]/10"
                    placeholder="seu_usuario"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Senha
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    disabled={isLoading}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white/80 px-3 py-3 pl-10 pr-11 text-gray-900 outline-none transition-all focus:border-[#2e7675]/30 focus:bg-white focus:ring-4 focus:ring-[#2e7675]/10"
                    placeholder="********"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                      disabled={isLoading}
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="rounded-lg p-1 text-gray-400 transition-colors hover:text-[#2e7675] focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div
                  className="flex items-center gap-2 rounded-2xl border border-yellow-300 bg-yellow-50 px-3 py-3 text-sm text-yellow-800"
                  role="alert"
                >
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                disabled={isLoading}
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2e7675] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#256160] focus:outline-none focus:ring-4 focus:ring-[#2e7675]/20"
              >
                {isLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
