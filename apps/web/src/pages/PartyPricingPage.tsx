import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Save,
  BadgePercent,
  Table2,
  Check,
  Building2,
} from "lucide-react";
import {
  getParty,
  updateParty,
  getMastersParameters,
  getMastersPackages,
  getReferrerPrices,
  saveReferrerPrices,
  PARTY_TYPE_LABELS,
  type Party,
  type TestParameter,
  type TestPackage,
} from "../lib/api-client";

type Row =
  | { kind: "parameter"; id: string; code: string; name: string; defaultPrice: number }
  | { kind: "package"; id: string; code: string; name: string; defaultPrice: number | null };

export default function PartyPricingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [party, setParty] = useState<Party | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [pricingMode, setPricingMode] = useState<string>("default");
  const [discountPercent, setDiscountPercent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isDoctor = party?.partyType === "doctor";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [p, params, pkgs, prices] = await Promise.all([
        getParty(id),
        getMastersParameters(),
        getMastersPackages(),
        getReferrerPrices(id),
      ]);
      setParty(p);
      setPricingMode(p.pricingMode ?? "default");
      setDiscountPercent(p.discountPercent != null ? String(p.discountPercent) : "");

      const paramRows: Row[] = params
        .filter((x) => x.isActive)
        .map((x: TestParameter) => ({
          kind: "parameter",
          id: x.id,
          code: x.code,
          name: x.name,
          defaultPrice: x.defaultPrice,
        }));
      const pkgRows: Row[] = pkgs
        .filter((x) => x.isActive)
        .map((x: TestPackage) => ({
          kind: "package",
          id: x.id,
          code: x.code,
          name: x.name,
          defaultPrice: x.pricingMode === "fixed" ? x.fixedPrice : null,
        }));
      setRows([...pkgRows, ...paramRows]);

      const map: Record<string, string> = {};
      for (const pr of prices) {
        const key = pr.parameterId
          ? `parameter:${pr.parameterId}`
          : pr.packageId
            ? `package:${pr.packageId}`
            : "";
        if (key) map[key] = String(pr.price);
      }
      setOverrides(map);
    } catch {
      setError("Failed to load party pricing data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const rowKey = (r: Row) => `${r.kind}:${r.id}`;
  const rowDefault = (r: Row) => (r.defaultPrice != null ? r.defaultPrice : 0);

  const resolved = useMemo(() => {
    const disc = pricingMode === "discount" ? parseFloat(discountPercent || "0") : 0;
    return rows.map((r) => {
      const def = rowDefault(r);
      const override = overrides[rowKey(r)];
      let price: number;
      let mode: string;
      if (pricingMode === "custom" && override !== undefined && override !== "") {
        price = parseFloat(override) || 0;
        mode = "override";
      } else if (pricingMode === "discount") {
        price = def * (1 - disc / 100);
        mode = "discount";
      } else {
        price = def;
        mode = "default";
      }
      return { r, def, price, mode };
    });
  }, [rows, overrides, pricingMode, discountPercent]);

  const setOverride = (key: string, value: string) =>
    setOverrides((o) => ({ ...o, [key]: value }));

  const saveMode = async () => {
    if (!id || !party) return;
    setSaving(true);
    setError("");
    try {
      await updateParty(id, {
        pricingMode,
        discountPercent:
          pricingMode === "discount" ? parseFloat(discountPercent || "0") : null,
      });
      setParty({
        ...party,
        pricingMode,
        discountPercent:
          pricingMode === "discount" ? parseFloat(discountPercent || "0") : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save pricing mode");
    } finally {
      setSaving(false);
    }
  };

  const savePrices = async () => {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const payload: Array<{ parameterId?: string; packageId?: string; price: number }> = [];
      for (const r of rows) {
        const v = overrides[rowKey(r)];
        if (v !== undefined && v !== "") {
          payload.push({
            ...(r.kind === "parameter" ? { parameterId: r.id } : { packageId: r.id }),
            price: parseFloat(v),
          });
        }
      }
      await saveReferrerPrices(id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch {
      setError("Failed to save price list");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-100">
        <Loader2 className="size-6 text-accent-600 animate-spin" />
        <span className="ml-3 text-sm text-ink-400">Loading…</span>
      </div>
    );
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      {/* Header */}
      <div className="border-b border-line-200 bg-surface-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate("/parties")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-400 transition-colors duration-fast hover:text-ink-600"
          >
            <ArrowLeft className="size-4" /> All parties
          </button>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-100 to-accent-200 text-sm font-semibold text-accent-700">
              {party?.name ? initials(party.name) : "—"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-950">
                {party?.name ?? "Party"}
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-400">
                <Building2 className="size-3.5" />
                {party ? PARTY_TYPE_LABELS[party.partyType] : "Party"} · Rate card
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Pricing mode — doctors get mode cards, other parties default to the grid */}
        {isDoctor ? (
          <div className="rounded-md border border-line-200 bg-surface-0 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-ink-950">
                <BadgePercent className="size-4 text-accent-600" /> Pricing Mode
              </h2>
              <button
                onClick={saveMode}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
              >
                {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                {saving ? "Saving…" : "Save Mode"}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: "default", label: "Default", desc: "Walk-in list price" },
                { value: "discount", label: "Discount %", desc: "Flat % off all tests" },
                { value: "custom", label: "Custom price list", desc: "Per-test overrides" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPricingMode(m.value)}
                  className={`rounded-md border p-4 text-left transition-all duration-fast ${
                    pricingMode === m.value
                      ? "border-accent-500 bg-accent-100/60 ring-2 ring-accent-500/20"
                      : "border-line-200 hover:bg-surface-100"
                  }`}
                >
                  <div className="text-sm font-semibold text-ink-950">{m.label}</div>
                  <div className="mt-1 text-xs text-ink-400">{m.desc}</div>
                </button>
              ))}
            </div>

            {pricingMode === "discount" && (
              <div className="mt-4 flex items-end gap-3">
                <div className="w-40">
                  <label className="mb-1 block text-xs font-medium text-ink-600">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full rounded-sm border border-line-200 px-3 py-2 text-sm focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                  />
                </div>
                <p className="pb-2 text-xs text-ink-400">
                  Applied to every test's default price for this party.
                </p>
              </div>
            )}

            {pricingMode === "custom" && (
              <p className="mt-4 text-xs text-ink-400">
                Use the grid below to set per-test and per-package override prices.
                Blank = fall back to the default/discount rule.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-line-200 bg-surface-0 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink-950">
              <BadgePercent className="size-4 text-accent-600" /> Rate Card
            </h2>
            <p className="mt-1 text-xs text-ink-400">
              Per-test and per-package override prices for this{" "}
              {party ? PARTY_TYPE_LABELS[party.partyType].toLowerCase() : "party"}.
              Blank = walk-in list price.
            </p>
          </div>
        )}

        {/* Price grid */}
        {!isDoctor || pricingMode === "custom" ? (
          <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
            <div className="flex items-center justify-between border-b border-line-200 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-ink-950">
                <Table2 className="size-4 text-accent-600" /> Price List
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-ink-400">
                  {Object.keys(overrides).filter((k) => overrides[k] !== "").length}{" "}
                  overrides
                </span>
                <button
                  onClick={savePrices}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
                >
                  {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Bulk Save"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-200 bg-surface-100/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-medium">Kind</th>
                    <th className="px-3 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 text-right font-medium">Default ₹</th>
                    <th className="px-5 py-2.5 text-right font-medium">Override ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-200">
                  {resolved.map(({ r, def }) => {
                    const key = rowKey(r);
                    const val = overrides[key] ?? "";
                    return (
                      <tr key={key} className="transition-colors duration-fast hover:bg-surface-100/40">
                        <td className="px-5 py-2">
                          <span
                            className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              r.kind === "package"
                                ? "bg-accent-100 text-accent-700"
                                : "border border-line-200 bg-surface-100 text-ink-500"
                            }`}
                          >
                            {r.kind === "package" ? "Pkg" : "Test"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-ink-400">
                          {r.code}
                        </td>
                        <td className="px-3 py-2 text-ink-950">{r.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-ink-500">
                          {def.toFixed(2)}
                        </td>
                        <td className="px-5 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="—"
                            value={val}
                            onChange={(e) => setOverride(key, e.target.value)}
                            className={`w-28 rounded-sm border px-2 py-1.5 text-right font-mono text-sm focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 ${
                              val !== ""
                                ? "border-accent-300 bg-accent-50 text-accent-900"
                                : "border-line-200 bg-surface-0 text-ink-950"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-line-200 bg-surface-0 p-8 text-center text-sm text-ink-400">
            Switch to <span className="font-medium text-ink-600">Custom price list</span>{" "}
            above to set per-test overrides.
          </div>
        )}
      </div>
    </div>
  );
}
