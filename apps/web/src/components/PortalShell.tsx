import { useNavigate } from "react-router";
import { FlaskConical, LogOut, User } from "lucide-react";
import { useAuth } from "../lib/useAuth";

export default function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-100">
      <header className="sticky top-0 z-40 border-b border-line-200 bg-surface-0">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent-700 text-surface-0">
              <FlaskConical className="size-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight text-ink-950">THULIR03</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex size-7 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <User className="size-3.5" />
              </div>
              <span className="text-xs font-medium text-ink-950">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-1 text-xl font-semibold text-ink-950">{title}</h1>
        <p className="mb-6 text-sm text-ink-500">{subtitle}</p>
        {children}
      </main>
    </div>
  );
}
