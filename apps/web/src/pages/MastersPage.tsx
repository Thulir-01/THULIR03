import { useState } from "react";
import {
  Table2,
  Package,
  TestTube,
  Boxes,
  Ruler,
  CreditCard,
  Ban,
  BadgePercent,
  Percent,
  Building2,
  FlaskConical,
  Cpu,
  Briefcase,
} from "lucide-react";
import ParametersPanel from "./MastersParametersPage";
import PackagesPanel from "./MastersPackagesPage";
import LookupMasterPage, { LOOKUP_CONFIGS } from "./LookupMasterPage";
import MasterConfigPage from "./MasterConfigPage";
import { MASTER_CONFIGS } from "./masterConfigs";
import type { LookupMasterType } from "../lib/api-client";

type Tab = "parameters" | "packages" | LookupMasterType | "hospital" | "sample_type_master" | "method_master" | "instrument" | "client";

const LOOKUP_TABS: Array<{ type: LookupMasterType; icon: typeof Table2 }> = [
  { type: "container_type", icon: Boxes },
  { type: "unit", icon: Ruler },
  { type: "payment_mode", icon: CreditCard },
  { type: "rejection_reason", icon: Ban },
  { type: "discount_scheme", icon: BadgePercent },
  { type: "tax_rate", icon: Percent },
];

// Full master-configuration editors (Left: identity · Right: options/settings).
const MASTER_TABS: Array<{
  id: Tab;
  label: string;
  icon: typeof Table2;
  config: (typeof MASTER_CONFIGS)["hospital"];
}> = [
  { id: "hospital", label: "Hospitals", icon: Building2, config: MASTER_CONFIGS.hospital },
  { id: "sample_type_master", label: "Sample Types", icon: TestTube, config: MASTER_CONFIGS.sample_type },
  { id: "method_master", label: "Methods", icon: FlaskConical, config: MASTER_CONFIGS.method },
  { id: "instrument", label: "Instruments", icon: Cpu, config: MASTER_CONFIGS.instrument },
  { id: "client", label: "Clients / Labs", icon: Briefcase, config: MASTER_CONFIGS.client },
];

export default function MastersPage({ initialTab = "parameters" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Table2 }> = [
    { id: "parameters", label: "Test Parameters", icon: Table2 },
    { id: "packages", label: "Test Packages", icon: Package },
    ...MASTER_TABS.map(({ id, label, icon }) => ({ id, label, icon })),
    ...LOOKUP_TABS.map(({ type, icon }) => ({
      id: type as Tab,
      label: LOOKUP_CONFIGS[type].title,
      icon,
    })),
  ];

  const activeMaster = MASTER_TABS.find((t) => t.id === tab);

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header */}
      <div className="bg-surface-0 border-b border-line-200 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <h1 className="text-2xl font-bold text-ink-950">Masters</h1>
          <p className="text-sm text-ink-400 mt-1">
            Full master configuration (hospitals, samples, methods, instruments,
            clients) plus test parameters, packages and lookup catalogues
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
        {activeMaster && <MasterConfigPage key={activeMaster.id} config={activeMaster.config} />}
        {!activeMaster &&
          tab !== "parameters" &&
          tab !== "packages" && (
            <LookupMasterPage config={LOOKUP_CONFIGS[tab as LookupMasterType]} />
          )}
      </div>
    </div>
  );
}
