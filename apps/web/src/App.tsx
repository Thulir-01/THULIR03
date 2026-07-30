import "./index.css";
import { Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
              T
            </div>
            <span className="font-semibold text-lg text-slate-900">
              THULIR03
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm text-slate-600 hover:text-teal-600 font-medium transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm px-4 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            Sprint 2 — Auth & RBAC
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            THULIR03
            <span className="block text-teal-600 mt-1">
              Laboratory Information System
            </span>
          </h1>

          <p className="text-lg text-slate-500 max-w-lg mx-auto mb-10 leading-relaxed">
            A modern, configurable Laboratory Information Management System built for
            Indian diagnostic labs. Multi-tenant, NABL-ready, ABDM-integrated.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors"
            >
              <span>Get Started</span>
              <span className="text-sm opacity-70">→</span>
            </Link>
            <a
              href="/api/docs"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-gray-200 text-slate-600 font-medium hover:bg-white hover:border-teal-300 hover:text-teal-600 transition-all"
            >
              <span>API Documentation</span>
            </a>
          </div>
        </div>

        {/* Status cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          {[
            { label: "API Status", value: "Healthy", color: "text-green-600" },
            {
              label: "Database",
              value: "Connected",
              color: "text-green-600",
            },
            {
              label: "Version",
              value: "0.1.0",
              color: "text-slate-500",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-4 text-center hover:shadow-sm transition-shadow"
            >
              <div className="text-sm text-slate-400 mb-1">{item.label}</div>
              <div className={`font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-slate-400">
          THULIR03 LIMS &copy; {new Date().getFullYear()} &mdash; Built for
          Indian Diagnostic Labs
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
