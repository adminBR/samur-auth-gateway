import { useState, useEffect, useRef } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "./api/axios"; // adjust path if needed
import { isAuthenticated } from "./utils/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage(null);
    e.preventDefault();
    setIsLoading(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(async () => {
      try {
        console.log("logged");
        await loginUser(username, password);
        navigate("/");
      } catch (err) {
        const error = err as {
          response?: { status?: number };
          request?: unknown;
        };
        if (error.response?.status === 401) {
          setErrorMessage("Usuário ou senha inválidos.");
        } else if (error.request && !error.response) {
          setErrorMessage(
            "Servidor indisponível. Tente novamente em alguns minutos.",
          );
        } else {
          setErrorMessage(
            "Não foi possível completar o login. Tente novamente.",
          );
        }
        console.error("Login error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 1000); // 1000ms = 1 second
  };

  useEffect(() => {
    const checkLogin = async () => {
      const loggedIn = await isAuthenticated();
      console.log(loggedIn);
      if (loggedIn) {
        console.log("navigating...");
        navigate("/");
      }
    };
    checkLogin();
  }, [navigate]); // add dependency to avoid infinite loop

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="m-auto w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto h-16 w-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Serviços Samur</h2>
          <p className="text-gray-500 mt-2">
            Insira as credenciais para acessar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="seu_usuario"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="••••••••"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  disabled={isLoading}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
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
              className="flex items-center gap-2 pl-3 pr-4 py-2 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-lg text-sm"
              role="alert"
            >
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <button
              disabled={isLoading}
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
            >
              {isLoading ? (
                <LoaderCircle className="animate-spin w-5 h-5 text-white" />
              ) : (
                <p>Entrar</p>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
