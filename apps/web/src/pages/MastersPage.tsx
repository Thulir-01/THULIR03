import { useState } from "react";
import {
  Table2,
  Package,
  Stethoscope,
  TestTube,
  Boxes,
  Ruler,
  FlaskConical,
  CreditCard,
  Ban,
  BadgePercent,
  Percent,
} from "lucide-react";
import ParametersPanel from "./MastersParametersPage";
import PackagesPanel from "./MastersPackagesPage";
import ReferrersPage from "./ReferrersPage";
import LookupMasterPage, { LOOKUP_CONFIGS } from "./LookupMasterPage";
import type { LookupMasterType } from "../lib/api-client";

type Tab = "parameters" | "packages" | "referrers" | LookupMasterType;

const LOOKUP_TABS: Array<{ type: LookupMasterType; icon: typeof Table2 }> = [
  { type: "sample_type", icon: TestTube },
  { type: "container_type", icon: Boxes },
  { type: "unit", icon: Ruler },
  { type: "method", icon: FlaskConical },
  { type: "payment_mode", icon: CreditCard },
  { type: "rejection_reason", icon: Ban },
  { type: "discount_scheme", icon: BadgePercent },
  { type: "tax_rate", icon: Percent },
];

export default function MastersPage({ initialTab = "parameters" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Table2 }> = [
    { id: "parameters", label: "Test Parameters", icon: Table2 },
    { id: "packages", label: "Test Packages", icon: Package },
    { id: "referrers", label: "Referrers", icon: Stethoscope },
    ...LOOKUP_TABS.map(({ type, icon }) => ({
      id: type as Tab,
      label: LOOKUP_CONFIGS[type].title,
      icon,
    })),
  ];

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header */}
      <div className="bg-surface-0 border-b border-line-200 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <h1 className="text-2xl font-bold text-ink-950">Masters</h1>
          <p className="text-sm text-ink-400 mt-1">
            Parameters, packages, referrers and the lab's lookup catalogues —
            all in one place
          </p>
        </div>
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex gap-1 border-b border-line-200 overflow-x-auto no-scrollbar">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-fast ${
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
        {tab === "parameters" && <ParametersPanel />}
        {tab === "packages" && <PackagesPanel />}
        {tab === "referrers" && <ReferrersPage />}
        {tab !== "parameters" &&
          tab !== "packages" &&
          tab !== "referrers" && (
            <LookupMasterPage config={LOOKUP_CONFIGS[tab]} />
          )}
      </div>
    </div>
  );
}
