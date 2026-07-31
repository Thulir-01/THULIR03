import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Save,
  Stethoscope,
  BadgePercent,
  Table2,
  Check,
} from "lucide-react";
import {
  getReferrer,
  updateReferrer,
  getMastersParameters,
  getMastersPackages,
  getReferrerPrices,
  saveReferrerPrices,
  type Referrer,
  type TestParameter,
  type TestPackage,
} from "../lib/api-client";

type Row =
  | { kind: "parameter"; id: string; code: string; name: string; defaultPrice: number }
  | { kind: "package"; id: string; code: string; name: string; defaultPrice: number | null };

export default function ReferrerPricingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [pricingMode, setPricingMode] = useState<string>("default");
  const [discountPercent, setDiscountPercent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [ref, params, pkgs, prices] = await Promise.all([
        getReferrer(id),
        getMastersParameters(),
        getMastersPackages(),
        getReferrerPrices(id),
      ]);
      setReferrer(ref);
      setPricingMode(ref.pricingMode ?? "default");
      setDiscountPercent(ref.discountPercent != null ? String(ref.discountPercent) : "");

      const paramRows: Row[] = params
        .filter((p) => p.isActive)
        .map((p: TestParameter) => ({
          kind: "parameter",
          id: p.id,
          code: p.code,
          name: p.name,
          defaultPrice: p.defaultPrice,
        }));
      const pkgRows: Row[] = pkgs
        .filter((p) => p.isActive)
        .map((p: TestPackage) => ({
          kind: "package",
          id: p.id,
          code: p.code,
          name: p.name,
          defaultPrice: p.pricingMode === "fixed" ? p.fixedPrice : null,
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
      setError("Failed to load referrer pricing data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const rowKey = (r: Row) => `${r.kind}:${r.id}`;
  const rowDefault = (r: Row) =>
    r.defaultPrice != null ? r.defaultPrice : 0;

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
    if (!id || !referrer) return;
    setSaving(true);
    setError("");
    try {
      await updateReferrer(id, {
        pricingMode,
        discountPercent:
          pricingMode === "discount" ? parseFloat(discountPercent || "0") : null,
      });
      setReferrer({ ...referrer, pricingMode, discountPercent: pricingMode === "discount" ? parseFloat(discountPercent || "0") : null });
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

  const sumModePackages = rows.filter(
    (r) => r.kind === "package" && r.defaultPrice == null
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-100">
        <Loader2 className="size-6 text-accent-600 animate-spin" />
        <span className="ml-3 text-sm text-ink-400">Loading…</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      {/* Header */}
      <div className="bg-surface-0 border-b border-line-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate("/referrers")}
            className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 mb-4 transition-colors duration-fast"
          >
            <ArrowLeft className="size-4" /> All referrers
          </button>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-gradient-to-br from-accent-100 to-accent-200 flex items-center justify-center text-sm font-semibold text-accent-700">
              {referrer?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-950">
                {referrer?.name ?? "Referrer"}
              </h1>
              <p className="text-sm text-ink-400 mt-0.5 flex items-center gap-2">
                <Stethoscope className="size-3.5" />
                {referrer?.specialty || "Referring doctor"}
                {referrer?.clinicName && ` · ${referrer.clinicName}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Pricing mode */}
        <div className="rounded-md border border-line-200 bg-surface-0 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-950 flex items-center gap-2">
              <BadgePercent className="size-4 text-accent-600" /> Pricing Mode
            </h2>
            <button
              onClick={saveMode}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50"
            >
              {saved ? <Check className="size-4" /> : <Save className="size-4" />}
              {saving ? "Saving…" : "Save Mode"}
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
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
                <div className="text-xs text-ink-400 mt-1">{m.desc}</div>
              </button>
            ))}
          </div>

          {pricingMode === "discount" && (
            <div className="mt-4 flex items-end gap-3">
              <div className="w-40">
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>
              <p className="text-xs text-ink-400 pb-2">
                Applied to every test's default price for this referrer.
              </p>
            </div>
          )}

          {pricingMode === "custom" && (
            <p className="mt-4 text-xs text-ink-400">
              Use the grid below to set per-test and per-package override
              prices. Blank = fall back to the default/discount rule.
            </p>
          )}
        </div>

        {/* Custom price grid */}
        {pricingMode === "custom" && (
          <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line-200">
              <h2 className="font-semibold text-ink-950 flex items-center gap-2">
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50"
                >
                  {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Bulk Save"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-100/60 border-b border-line-200 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-medium">Kind</th>
                    <th className="px-3 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Default ₹
                    </th>
                    <th className="px-5 py-2.5 font-medium text-right">
                      Override ₹
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-200">
                  {resolved.map(({ r, def }) => {
                    const key = rowKey(r);
                    const val = overrides[key] ?? "";
                    return (
                      <tr key={key} className="hover:bg-surface-100/40 transition-colors duration-fast">
                        <td className="px-5 py-2">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wide ${
                              r.kind === "package"
                                ? "bg-accent-100 text-accent-700"
                                : "bg-surface-100 border border-line-200 text-ink-500"
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
                            className={`w-28 text-right px-2 py-1.5 rounded-sm border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 ${
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

            <div className="px-5 py-3 border-t border-line-200 text-[11px] text-ink-400 flex items-center justify-between">
              <span>
                {sumModePackages.length > 0 &&
                  "Sum-mode packages follow the included parameters' overrides automatically."}
              </span>
              <span className="font-medium text-ink-500">
                Changing mode back to Default/Discount keeps these rows — they
                just stop applying.
              </span>
            </div>
          </div>
        )}

        {/* Summary */}
        {pricingMode !== "custom" && (
          <div className="rounded-md border border-line-200 bg-surface-0 p-5">
            <h3 className="text-sm font-semibold text-ink-950 mb-3">
              How prices resolve
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-ink-500">
              {resolved.slice(0, 12).map(({ r, price }) => (
                <div
                  key={rowKey(r)}
                  className="flex items-center justify-between rounded-sm border border-line-200 px-3 py-2"
                >
                  <span className="truncate pr-2">
                    <span className="font-mono text-ink-400 mr-1.5">{r.code}</span>
                    {r.name}
                  </span>
                  <span className="font-mono font-semibold text-ink-950">
                    ₹{price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              {pricingMode === "discount"
                ? `Flat ${discountPercent || 0}% off default prices.`
                : "Default list prices apply (walk-in rate)."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
