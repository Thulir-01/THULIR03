import { useState } from "react";
import { Table2, Package } from "lucide-react";
import ParametersPanel from "./MastersParametersPage";
import PackagesPanel from "./MastersPackagesPage";

type Tab = "parameters" | "packages";

export default function MastersPage({ initialTab = "parameters" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Table2 }> = [
    { id: "parameters", label: "Test Parameters", icon: Table2 },
    { id: "packages", label: "Test Packages", icon: Package },
  ];

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header */}
      <div className="bg-surface-0 border-b border-line-200 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <h1 className="text-2xl font-bold text-ink-950">Masters</h1>
          <p className="text-sm text-ink-400 mt-1">
            The test catalogue — parameters, packages and pricing — in one
            place
          </p>
        </div>
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex gap-1 border-b border-line-200">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-fast ${
                  tab === t.id
                    ? "border-accent-600 text-accent-700"
                    : "border-transparent text-ink-500 hover:text-ink-800 hover:border-line-300"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "parameters" ? <ParametersPanel /> : <PackagesPanel />}
      </div>
    </div>
  );
}
