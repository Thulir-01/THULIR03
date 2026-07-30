import './index.css';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">
              T
            </div>
            <span className="font-semibold text-lg text-[var(--text-primary)]">
              THULIR03
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-muted)]">v0.1.0</span>
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-normal)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-normal)] inline-block animate-pulse" />
              System Online
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
            Sprint 1 — Project Scaffolding
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4 tracking-tight">
            THULIR03
            <span className="block text-[var(--color-primary)] mt-1">Laboratory Information System</span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] max-w-lg mx-auto mb-10 leading-relaxed">
            A modern, configurable Laboratory Information Management System built for
            Indian diagnostic labs. Multi-tenant, NABL-ready, ABDM-integrated.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="/api/docs"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <span>API Documentation</span>
              <span className="text-sm opacity-70">→</span>
            </a>
            <button
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--text-secondary)] font-medium hover:bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
            >
              <span>Health Check</span>
            </button>
          </div>
        </div>

        {/* Status cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          {[
            { label: 'API Status', value: 'Healthy', color: 'text-[var(--color-normal)]' },
            { label: 'Database', value: 'Connected', color: 'text-[var(--color-normal)]' },
            { label: 'Version', value: '0.1.0', color: 'text-[var(--text-secondary)]' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-center hover:shadow-sm transition-shadow"
            >
              <div className="text-sm text-[var(--text-muted)] mb-1">{item.label}</div>
              <div className={`font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          THULIR03 LIMS &copy; {new Date().getFullYear()} &mdash; Built for Indian Diagnostic Labs
        </div>
      </footer>
    </div>
  );
}

export default App;
