import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  Search,
  Plus,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CalendarClock,
  Boxes,
  Truck,
  Pencil,
  Trash2,
  X,
  FlaskConical,
  Layers,
} from "lucide-react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryTransactions,
  getInventorySuppliers,
  createInventorySupplier,
  updateInventorySupplier,
  deleteInventorySupplier,
  getInventoryAlerts,
  getTestRequirements,
  setTestRequirement,
  deleteTestRequirement,
  stockIn,
  stockOut,
  getMastersParameters,
  type InventoryItem,
  type InventorySupplier,
  type InventoryTransaction,
  type InventoryAlerts,
  type TestRequirement,
  type TestParameter,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

type Tab = "items" | "stock" | "suppliers" | "alerts" | "links";

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function InventoryPage() {
  // The ribbon strip navigates to /inventory/:section — the section drives
  // which panel renders (no content-area tab bar).
  const { section } = useParams();
  const tab: Tab =
    section === "stock" || section === "suppliers" || section === "alerts" || section === "links"
      ? section
      : "items";

  // Items
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState("");

  // Stock ledger
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txFilter, setTxFilter] = useState<{ itemId?: string; type?: string }>({});

  // Suppliers
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  // Alerts
  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Test links
  const [requirements, setRequirements] = useState<TestRequirement[]>([]);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [linkItemId, setLinkItemId] = useState<string>("");
  const [linkQty, setLinkQty] = useState<Record<string, string>>({});
  const [loadingLinks, setLoadingLinks] = useState(true);

  // Modals
  const [itemModal, setItemModal] = useState<null | "new" | InventoryItem>(null);
  const [stockModal, setStockModal] = useState<null | { type: "in" | "out"; item: InventoryItem }>(null);
  const [supplierModal, setSupplierModal] = useState<null | "new" | InventorySupplier>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setItemsError("");
    try {
      const data = await getInventoryItems({
        search: search || undefined,
        lowStock: lowStockOnly ? "true" : undefined,
      });
      setItems(data);
    } catch {
      setItems([]);
      setItemsError("Failed to load inventory items.");
    } finally {
      setLoadingItems(false);
    }
  }, [search, lowStockOnly]);

  useEffect(() => {
    const t = setTimeout(loadItems, 300);
    return () => clearTimeout(t);
  }, [loadItems]);

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      setTransactions(await getInventoryTransactions(txFilter));
    } catch {
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  }, [txFilter]);

  useEffect(() => {
    if (tab === "stock") void loadTransactions();
  }, [tab, loadTransactions]);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      setSuppliers(await getInventorySuppliers());
    } catch {
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      setAlerts(await getInventoryAlerts());
    } catch {
      setAlerts(null);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const [reqs, params, allItems] = await Promise.all([
        getTestRequirements(),
        getMastersParameters({ isActive: "true" }),
        getInventoryItems({ includeInactive: "true" }),
      ]);
      setRequirements(reqs);
      setParameters(params);
      if (allItems.length > 0 && !allItems.some((i) => i.id === linkItemId)) {
        setLinkItemId(allItems[0].id);
      }
    } catch {
      setRequirements([]);
      setParameters([]);
    } finally {
      setLoadingLinks(false);
    }
  }, [linkItemId]);

  useEffect(() => {
    if (tab === "suppliers") void loadSuppliers();
    if (tab === "alerts") void loadAlerts();
    if (tab === "links") void loadLinks();
  }, [tab, loadSuppliers, loadAlerts, loadLinks]);

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  // ─── Item actions ────────────────────────────────────────────────────

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const body = {
      name: String(fd.get("name") || "").trim(),
      sku: String(fd.get("sku") || "").trim(),
      category: String(fd.get("category") || "").trim() || undefined,
      unit: String(fd.get("unit") || "").trim() || undefined,
      minStock: Number(fd.get("minStock") || 0),
      supplierId: String(fd.get("supplierId") || "") || undefined,
    };
    if (!body.name || !body.sku) {
      alert("Name and SKU are required");
      return;
    }
    setSaving(true);
    try {
      if (itemModal === "new") {
        await createInventoryItem(body);
        notify("Item added");
      } else if (itemModal) {
        await updateInventoryItem(itemModal.id, body);
        notify("Item updated");
      }
      setItemModal(null);
      await loadItems();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const quantity = Number(fd.get("quantity") || 0);
    if (!quantity || quantity <= 0) {
      alert("Quantity must be greater than zero");
      return;
    }
    setSaving(true);
    try {
      if (stockModal.type === "in") {
        await stockIn({
          itemId: stockModal.item.id,
          quantity,
          batchNo: String(fd.get("batchNo") || "") || undefined,
          expiryDate: String(fd.get("expiryDate") || "") || undefined,
          unitCost: Number(fd.get("unitCost") || 0) || undefined,
          reference: String(fd.get("reference") || "") || undefined,
          notes: String(fd.get("notes") || "") || undefined,
        });
        notify("Stock received");
      } else {
        await stockOut({
          itemId: stockModal.item.id,
          quantity,
          reference: String(fd.get("reference") || "") || undefined,
          notes: String(fd.get("notes") || "") || undefined,
        });
        notify("Stock issued");
      }
      setStockModal(null);
      await Promise.all([loadItems(), loadTransactions()]);
    } catch (err: any) {
      alert(err.response?.data?.message || "Stock movement failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteInventoryItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notify("Item deleted");
    } catch {
      alert("Failed to delete item");
    }
  };

  // ─── Supplier actions ────────────────────────────────────────────────

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const body = {
      name: String(fd.get("name") || "").trim(),
      contactPerson: String(fd.get("contactPerson") || "").trim() || undefined,
      phone: String(fd.get("phone") || "").trim() || undefined,
      email: String(fd.get("email") || "").trim() || undefined,
      address: String(fd.get("address") || "").trim() || undefined,
    };
    if (!body.name) {
      alert("Supplier name is required");
      return;
    }
    setSaving(true);
    try {
      if (supplierModal === "new") {
        await createInventorySupplier(body);
        notify("Supplier added");
      } else if (supplierModal) {
        await updateInventorySupplier(supplierModal.id, body);
        notify("Supplier updated");
      }
      setSupplierModal(null);
      await loadSuppliers();
    } catch {
      alert("Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (s: InventorySupplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await deleteInventorySupplier(s.id);
      setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
      notify("Supplier deleted");
    } catch {
      alert("Failed to delete supplier");
    }
  };

  // ─── Test links ──────────────────────────────────────────────────────

  const linkedQty = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requirements) {
      if (r.itemId === linkItemId) map[r.parameterId] = r.quantity;
    }
    return map;
  }, [requirements, linkItemId]);

  const saveLink = async (parameterId: string, qty: number) => {
    if (!linkItemId) return;
    try {
      if (qty <= 0) {
        const existing = requirements.find(
          (r) => r.itemId === linkItemId && r.parameterId === parameterId,
        );
        if (existing) {
          await deleteTestRequirement(existing.id);
        }
      } else {
        await setTestRequirement({ parameterId, itemId: linkItemId, quantity: qty });
      }
      setRequirements(await getTestRequirements({ itemId: linkItemId }));
      setLinkQty({});
      notify(qty > 0 ? "Test linked" : "Link removed");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update test link");
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Inventory"
            subtitle="Reagents & consumables — stock levels, movements, suppliers and test consumption"
            actions={
              <button
                onClick={() => setItemModal("new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <Plus className="size-3.5" /> Add Item
              </button>
            }
          />
        </div>

        {flash && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
            {flash}
          </div>
        )}


        {/* ─── ITEMS ─── */}
        {tab === "items" && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search name, SKU or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-line-300 bg-surface-0 py-2.5 pl-10 pr-4 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="size-4 accent-accent-700"
                />
                Low stock only
              </label>
            </div>

            {loadingItems ? (
              <LoadingState label="Loading items…" rows={6} />
            ) : itemsError ? (
              <ErrorState message={itemsError} onRetry={loadItems} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title={search ? "No items match your search" : "No inventory items yet"}
                hint={search ? "Try a different search" : "Add your first reagent or consumable to start tracking stock"}
                action={
                  !search ? (
                    <button
                      onClick={() => setItemModal("new")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <Plus className="size-3.5" /> Add Item
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line-200 bg-surface-100 text-[11px] uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">SKU</th>
                      <th className="px-4 py-3 font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right font-semibold">On hand</th>
                      <th className="px-4 py-3 text-right font-semibold">Min</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-200">
                    {items.map((item) => (
                      <tr key={item.id} className="transition-colors duration-fast hover:bg-surface-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
                              <Boxes className="size-4" />
                            </div>
                            <div>
                              <div className="font-medium text-ink-950">{item.name}</div>
                              <div className="text-xs text-ink-400">
                                {[item.category, item.unit].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 data-mono text-xs text-ink-600">{item.sku}</td>
                        <td className="px-4 py-3 text-ink-600">{item.supplierName ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${
                              item.lowStock
                                ? "bg-status-critical/10 text-status-critical"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {fmtQty(item.quantityOnHand)}
                            {item.lowStock && <AlertTriangle className="size-3" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-ink-600">{fmtQty(item.minStock)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setStockModal({ type: "in", item })}
                              title="Stock in"
                              className="inline-flex items-center gap-1 rounded-sm bg-green-600 px-2 py-1 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-green-700"
                            >
                              <ArrowDownToLine className="size-3" /> In
                            </button>
                            <button
                              onClick={() => setStockModal({ type: "out", item })}
                              title="Stock out"
                              className="inline-flex items-center gap-1 rounded-sm bg-accent-700 px-2 py-1 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                            >
                              <ArrowUpFromLine className="size-3" /> Out
                            </button>
                            <button
                              onClick={() => setItemModal(item)}
                              className="text-ink-400 transition-colors duration-fast hover:text-accent-700"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="text-ink-400 transition-colors duration-fast hover:text-status-critical"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── STOCK LEDGER ─── */}
        {tab === "stock" && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <select
                value={txFilter.itemId ?? ""}
                onChange={(e) => setTxFilter((f) => ({ ...f, itemId: e.target.value || undefined }))}
                className="rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
              >
                <option value="">All items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <select
                value={txFilter.type ?? ""}
                onChange={(e) => setTxFilter((f) => ({ ...f, type: e.target.value || undefined }))}
                className="rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
              >
                <option value="">All types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
              </select>
            </div>

            {loadingTx ? (
              <LoadingState label="Loading stock movements…" rows={6} />
            ) : transactions.length === 0 ? (
              <EmptyState icon={Layers} title="No stock movements" hint="Stock in / out entries will appear here" />
            ) : (
              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line-200 bg-surface-100 text-[11px] uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 font-semibold">Batch / Expiry</th>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-200">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="transition-colors duration-fast hover:bg-surface-100">
                        <td className="px-4 py-3 text-xs text-ink-600">
                          {new Date(tx.performedAt).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink-950">{tx.itemName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
                              tx.type === "in" ? "bg-green-50 text-green-700" : "bg-accent-100 text-accent-700"
                            }`}
                          >
                            {tx.type === "in" ? (
                              <ArrowDownToLine className="size-3" />
                            ) : (
                              <ArrowUpFromLine className="size-3" />
                            )}
                            {tx.type === "in" ? "IN" : "OUT"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right data-mono font-semibold text-ink-950">
                          {fmtQty(tx.quantity)}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-600">
                          {tx.batchNo || "—"}
                          {tx.expiryDate && <span className="ml-2">exp {fmtDate(tx.expiryDate)}</span>}
                          {tx.unitCost ? <span className="ml-2">₹{tx.unitCost}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-600">{tx.reference ?? tx.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── SUPPLIERS ─── */}
        {tab === "suppliers" && (
          <>
            <div className="mb-5">
              <button
                onClick={() => setSupplierModal("new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <Plus className="size-3.5" /> Add Supplier
              </button>
            </div>
            {loadingSuppliers ? (
              <LoadingState label="Loading suppliers…" rows={4} />
            ) : suppliers.length === 0 ? (
              <EmptyState icon={Truck} title="No suppliers yet" hint="Add reagent / consumable suppliers" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suppliers.map((s) => (
                  <div key={s.id} className="rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-md bg-accent-100 text-accent-700">
                          <Truck className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-ink-950">{s.name}</h3>
                          {s._count && s._count.items > 0 && (
                            <span className="text-xs text-ink-400">{s._count.items} items</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSupplierModal(s)}
                          className="text-ink-400 hover:text-accent-700"
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(s)}
                          className="text-ink-400 hover:text-status-critical"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-ink-600">
                      {s.contactPerson && <div>Contact: {s.contactPerson}</div>}
                      {s.phone && <div>📞 {s.phone}</div>}
                      {s.email && <div className="truncate">{s.email}</div>}
                      {s.address && <div className="truncate text-xs text-ink-400">{s.address}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── ALERTS ─── */}
        {tab === "alerts" && (
          loadingAlerts ? (
            <LoadingState label="Checking stock…" rows={4} />
          ) : alerts && (alerts.lowStock.length + alerts.expiring.length + alerts.expired.length) > 0 ? (
            <div className="space-y-6">
              {alerts.lowStock.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-status-critical">
                    <AlertTriangle className="size-4" /> Low stock ({alerts.lowStock.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {alerts.lowStock.map((i) => (
                      <div key={i.id} className="rounded-md border border-status-critical/30 bg-surface-0 p-4">
                        <div className="text-sm font-semibold text-ink-950">{i.name}</div>
                        <div className="mt-1 text-xs text-ink-500">
                          {fmtQty(i.quantityOnHand)} {i.unit || "units"} on hand · min {fmtQty(i.minStock)}
                        </div>
                        <div className="mt-2 text-[11px] text-ink-400">SKU {i.sku}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {alerts.expiring.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <CalendarClock className="size-4" /> Expiring within 30 days ({alerts.expiring.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {alerts.expiring.map((b) => (
                      <div key={b.id} className="rounded-md border border-amber-300 bg-surface-0 p-4">
                        <div className="text-sm font-semibold text-ink-950">{b.itemName}</div>
                        <div className="mt-1 text-xs text-ink-500">
                          Batch {b.batchNo ?? "—"} · expires {fmtDate(b.expiryDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {alerts.expired.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-status-critical">
                    <X className="size-4" /> Expired ({alerts.expired.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {alerts.expired.map((b) => (
                      <div key={b.id} className="rounded-md border border-status-critical/30 bg-surface-0 p-4">
                        <div className="text-sm font-semibold text-ink-950">{b.itemName}</div>
                        <div className="mt-1 text-xs text-ink-500">
                          Batch {b.batchNo ?? "—"} · expired {fmtDate(b.expiryDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <EmptyState icon={AlertTriangle} title="All clear" hint="No low-stock or expiry alerts right now" />
          )
        )}

        {/* ─── TEST LINKS ─── */}
        {tab === "links" && (
          loadingLinks ? (
            <LoadingState label="Loading test catalog…" rows={6} />
          ) : (
            <>
              <div className="mb-5 max-w-md">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Inventory item
                </label>
                <select
                  value={linkItemId}
                  onChange={(e) => setLinkItemId(e.target.value)}
                  className="w-full rounded-md border border-line-300 bg-surface-0 px-3 py-2.5 text-sm focus:border-accent-500 focus:outline-none"
                >
                  {items.filter((i) => i.isActive).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {fmtQty(i.quantityOnHand)} {i.unit || "units"}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-400">
                  Set how much of this item each test consumes. Quantity 0 removes the link.
                </p>
              </div>

              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line-200 bg-surface-100 text-[11px] uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Test</th>
                      <th className="px-4 py-3 font-semibold">Code</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty per test</th>
                      <th className="px-4 py-3 text-right font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-200">
                    {parameters.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">
                          No active tests in the catalog yet.
                        </td>
                      </tr>
                    )}
                    {parameters.map((p) => {
                      const linked = linkedQty[p.id];
                      const draft = linkQty[p.id];
                      const display = draft !== undefined ? Number(draft) : linked ?? 0;
                      return (
                        <tr key={p.id} className="transition-colors duration-fast hover:bg-surface-100">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <FlaskConical className="size-3.5 text-ink-400" />
                              <span className="font-medium text-ink-950">{p.name}</span>
                              {linked !== undefined && (
                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  linked
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 data-mono text-xs text-ink-600">{p.code}</td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={display === 0 ? "" : display}
                              placeholder="—"
                              onChange={(e) =>
                                setLinkQty((q) => ({ ...q, [p.id]: e.target.value }))
                              }
                              className="w-24 rounded-md border border-line-300 bg-surface-0 px-2 py-1.5 text-right text-sm focus:border-accent-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => saveLink(p.id, Number(linkQty[p.id] ?? linked ?? 0))}
                              className="rounded-sm bg-accent-700 px-2.5 py-1 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      {/* ─── Item modal ─── */}
      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/30 px-4 pt-[10vh]">
          <div className="w-full max-w-md rounded-md border border-line-200 bg-surface-0 p-6 shadow-overlay">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink-950">
                {itemModal === "new" ? "Add inventory item" : "Edit item"}
              </h3>
              <button onClick={() => setItemModal(null)} className="text-ink-400 hover:text-ink-950">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={saveItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Name *</label>
                  <input
                    name="name"
                    defaultValue={itemModal === "new" ? "" : itemModal.name}
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">SKU *</label>
                  <input
                    name="sku"
                    defaultValue={itemModal === "new" ? "" : itemModal.sku}
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Category</label>
                  <input
                    name="category"
                    defaultValue={itemModal === "new" ? "" : (itemModal.category ?? "")}
                    placeholder="e.g. Reagents"
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Unit</label>
                  <input
                    name="unit"
                    defaultValue={itemModal === "new" ? "" : (itemModal.unit ?? "")}
                    placeholder="e.g. ml, kit, strip"
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Supplier</label>
                <select
                  name="supplierId"
                  defaultValue={itemModal === "new" ? "" : (itemModal.supplierId ?? "")}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                >
                  <option value="">— None —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">
                  Reorder level (min stock)
                </label>
                <input
                  name="minStock"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={itemModal === "new" ? 0 : itemModal.minStock}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModal(null)}
                  className="rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 hover:bg-accent-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Stock modal ─── */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/30 px-4 pt-[12vh]">
          <div className="w-full max-w-md rounded-md border border-line-200 bg-surface-0 p-6 shadow-overlay">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink-950">
                {stockModal.type === "in" ? "Stock in" : "Stock out"} — {stockModal.item.name}
              </h3>
              <button onClick={() => setStockModal(null)} className="text-ink-400 hover:text-ink-950">
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-ink-500">
              On hand: <b>{fmtQty(stockModal.item.quantityOnHand)} {stockModal.item.unit || "units"}</b>
            </p>
            <form onSubmit={handleStock} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Quantity *</label>
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  step="any"
                  required
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              {stockModal.type === "in" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-600">Batch no</label>
                      <input
                        name="batchNo"
                        className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-600">Expiry date</label>
                      <input
                        name="expiryDate"
                        type="date"
                        className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600">Unit cost (₹)</label>
                    <input
                      name="unitCost"
                      type="number"
                      min={0}
                      step="any"
                      className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Reference / notes</label>
                <input
                  name="reference"
                  placeholder={stockModal.type === "in" ? "e.g. PO-1024, Invoice 8821" : "e.g. CBC panel (Order ORD-…)"}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModal(null)}
                  className="rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-md px-4 py-2 text-xs font-semibold text-surface-0 disabled:opacity-50 ${
                    stockModal.type === "in" ? "bg-green-600 hover:bg-green-700" : "bg-accent-700 hover:bg-accent-500"
                  }`}
                >
                  {saving ? "Saving…" : stockModal.type === "in" ? "Receive stock" : "Issue stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Supplier modal ─── */}
      {supplierModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/30 px-4 pt-[10vh]">
          <div className="w-full max-w-md rounded-md border border-line-200 bg-surface-0 p-6 shadow-overlay">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink-950">
                {supplierModal === "new" ? "Add supplier" : "Edit supplier"}
              </h3>
              <button onClick={() => setSupplierModal(null)} className="text-ink-400 hover:text-ink-950">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={saveSupplier} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Name *</label>
                <input
                  name="name"
                  defaultValue={supplierModal === "new" ? "" : supplierModal.name}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Contact person</label>
                <input
                  name="contactPerson"
                  defaultValue={supplierModal === "new" ? "" : (supplierModal.contactPerson ?? "")}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Phone</label>
                  <input
                    name="phone"
                    defaultValue={supplierModal === "new" ? "" : (supplierModal.phone ?? "")}
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Email</label>
                  <input
                    name="email"
                    defaultValue={supplierModal === "new" ? "" : (supplierModal.email ?? "")}
                    className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Address</label>
                <input
                  name="address"
                  defaultValue={supplierModal === "new" ? "" : (supplierModal.address ?? "")}
                  className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSupplierModal(null)}
                  className="rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 hover:bg-accent-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
