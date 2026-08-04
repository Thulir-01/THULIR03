import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FlaskConical, LogIn, Eye, EyeOff, Loader2, ScanLine } from "lucide-react";
import { useAuth } from "../lib/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  function homeForRole(role: string) {
    if (role === "patient") return "/portal/patient";
    if (role === "referrer") return "/portal/referrer";
    return "/dashboard";
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      navigate(homeForRole(stored.role ?? ""));
    } catch (err: any) {
      if (err.response) {
        // Backend responded — surface its message (401 → "Invalid email or password", etc.)
        setError(err.response.data?.message || "Invalid email or password");
      } else {
        // No response — network/proxy failure: the backend isn't reachable
        setError(
          "Server unreachable — the backend is not responding. Please check the connection and try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-xl bg-teal-600 text-white mb-4">
            <FlaskConical className="size-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">THULIR03</h1>
          <p className="text-gray-500 mt-1">Laboratory Information System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@thulir03.com"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Create one
            </Link>
          </p>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-center text-xs text-gray-400">
              Patients & referrers sign in here with portal credentials
            </p>
            <Link
              to="/verify-report"
              className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
            >
              <ScanLine className="size-3.5" /> Verify a report without signing in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
