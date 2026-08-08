import { useParams } from "react-router";
import ParametersPanel from "./MastersParametersPage";
import PackagesPanel from "./MastersPackagesPage";
import LookupMasterPage, { LOOKUP_CONFIGS } from "./LookupMasterPage";
import MasterConfigPage from "./MasterConfigPage";
import { MASTER_CONFIGS } from "./masterConfigs";
import type { LookupMasterType } from "../lib/api-client";

// Sample types and methods are handled by the full master-config editors
// (sample_type_master / method_master) — the plain lookup variants are not
// routed, so the lookup portion of the Tab union is narrowed accordingly.
type LookupTab = Exclude<LookupMasterType, "sample_type" | "method">;
type Tab =
  | "parameters"
  | "packages"
  | LookupTab
  | "hospital"
  | "sample_type_master"
  | "method_master"
  | "instrument"
  | "client";

// tab id → URL slug. The ribbon strip in components/AppShell.tsx (Masters
// tab groups) navigates with these exact slugs — keep both in sync.
const TAB_SLUGS: Record<Tab, string> = {
  parameters: "parameters",
  packages: "packages",
  hospital: "hospitals",
  sample_type_master: "sample-types",
  method_master: "methods",
  instrument: "instruments",
  client: "clients",
  container_type: "containers",
  unit: "units",
  payment_mode: "payment-modes",
  rejection_reason: "rejection-reasons",
  discount_scheme: "discount-schemes",
  tax_rate: "tax-rates",
};

const SLUG_TO_TAB: Record<string, Tab> = Object.fromEntries(
  (Object.entries(TAB_SLUGS) as [Tab, string][]).map(([tab, slug]) => [slug, tab]),
);

// Full master-configuration editors (Left: identity · Right: options/settings).
const MASTER_TABS: Array<{
  id: Tab;
  config: (typeof MASTER_CONFIGS)[keyof typeof MASTER_CONFIGS];
}> = [
  { id: "hospital", config: MASTER_CONFIGS.hospital },
  { id: "sample_type_master", config: MASTER_CONFIGS.sample_type },
  { id: "method_master", config: MASTER_CONFIGS.method },
  { id: "instrument", config: MASTER_CONFIGS.instrument },
  { id: "client", config: MASTER_CONFIGS.client },
];

export default function MastersPage() {
  const { section } = useParams();
  const tab: Tab = (section ? SLUG_TO_TAB[section] : undefined) ?? "parameters";
  const activeMaster = MASTER_TABS.find((t) => t.id === tab);

  return (
    <div className="h-full min-h-0 overflow-hidden bg-surface-100">
      {tab === "parameters" && <ParametersPanel />}
      {tab === "packages" && <PackagesPanel />}
      {activeMaster && <MasterConfigPage key={activeMaster.id} config={activeMaster.config} />}
      {!activeMaster && tab !== "parameters" && tab !== "packages" && (
        <LookupMasterPage config={LOOKUP_CONFIGS[tab as LookupMasterType]} />
      )}
    </div>
  );
}
