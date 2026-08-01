import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  ClipboardList,
  Users,
  Beaker,
  IndianRupee,
  FilePlus2,
  Stethoscope,
  History,
  ArrowRight,
  Phone,
  Calendar,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { getDashboardStats, type DashboardStats, type OrderListItem } from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getDashboardStats()
      .then((data) => {
        setStats(data);
        setRecentOrders(data.recentOrders);
      })
      .catch(() => {
        setStats(null);
        setRecentOrders([]);
        setError("Failed to load the dashboard. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleName =
    user?.role === "lab_admin"
      ? "Lab Admin"
      : user?.role === "pathologist"
        ? "Pathologist"
        : user?.role === "technician"
          ? "Technician"
          : user?.role;

  const totalOrders = stats?.totalOrders ?? 0;
  const pendingTests = stats?.pendingTests ?? 0;
  const todayRevenue = stats?.todayRevenue ?? 0;
  const patientCount = stats?.totalPatients ?? 0;

  const inr = (v: number) =>
    `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const quickActions = [
    { icon: FilePlus2, label: "New Registration", desc: "Full-screen patient registration with billing", to: "/registration", primary: true },
    { icon: ClipboardList, label: "Orders", desc: "View all lab orders", to: "/orders" },
    { icon: Beaker, label: "Result Entry", desc: "Enter test results", to: "/results" },
    { icon: Users, label: "Patients", desc: "Manage patient records", to: "/patients" },
    { icon: Stethoscope, label: "Referrers", desc: "Manage referring doctors", to: "/referrers" },
    { icon: History, label: "Audit Trail", desc: "Browse all activity logs", to: "/audit" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <PageHeader
            title={`Welcome back, ${user?.firstName}`}
            subtitle={`Here's your lab overview for today · ${roleName}`}
            actions={
              <button
                onClick={() => navigate("/registration")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <FilePlus2 className="size-3.5" /> New Registration
              </button>
            }
          />
        </div>

        {loading ? (
          <LoadingState label="Loading dashboard…" rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Orders" value={String(totalOrders)} icon={ClipboardList} accent="accent" />
              <StatCard label="Total Patients" value={String(patientCount)} icon={Users} accent="blue" />
              <StatCard label="Pending Tests" value={String(pendingTests)} icon={Beaker} accent="amber" />
              <StatCard label="Today's Revenue" value={inr(todayRevenue)} icon={IndianRupee} accent="green" />
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <h2 className="mb-4 text-base font-semibold text-ink-950">Quick Actions</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.to)}
                    className={`group rounded-md border p-4 text-left transition-all duration-fast ${
                      action.primary
                        ? "border-accent-700 bg-gradient-to-br from-accent-700 to-accent-500 text-surface-0 shadow-raised hover:brightness-110"
                        : "border-line-200 bg-surface-0 hover:border-accent-500 hover:shadow-raised"
                    }`}
                  >
                    <div
                      className={`mb-3 flex size-10 items-center justify-center rounded-md ${
                        action.primary ? "bg-surface-0/15 text-surface-0" : "bg-accent-100 text-accent-700 group-hover:bg-accent-700 group-hover:text-surface-0"
                      } transition-colors duration-fast`}
                    >
                      <action.icon className="size-5" />
                    </div>
                    <h3 className={`font-medium ${action.primary ? "text-surface-0" : "text-ink-950"}`}>
                      {action.label}
                    </h3>
                    <p className={`mt-1 text-xs ${action.primary ? "text-surface-0/80" : "text-ink-600"}`}>
                      {action.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-md border border-line-200 bg-surface-0 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink-950">Recent Orders</h2>
                <Link
                  to="/orders"
                  className="flex items-center gap-1 text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
                >
                  View All <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No recent orders"
                  hint="Register a patient to create your first order"
                  action={
                    <button
                      onClick={() => navigate("/registration")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <FilePlus2 className="size-3.5" /> New Registration
                    </button>
                  }
                />
              ) : (
                <div className="divide-y divide-line-200">
                  {recentOrders.map((order) => {
                    const totalAmt = parseFloat(order.totalAmount || "0");
                    const balAmt = parseFloat(order.balanceAmount || "0");
                    const testCount = order.tests.length;
                    const completedTests = order.tests.filter((t) => t.status === "completed").length;
                    const date = new Date(order.createdAt);

                    return (
                      <div
                        key={order.id}
                        className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-3 transition-colors duration-fast hover:bg-surface-100"
                        onClick={() => navigate("/orders")}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
                            {order.patient.firstName.charAt(0)}
                            {order.patient.lastName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-ink-950">
                                {order.patient.firstName} {order.patient.lastName}
                              </span>
                              {order.emergency && (
                                <span className="shrink-0 rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-status-critical">
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-600">
                              <span className="font-mono font-medium text-accent-700">{order.orderNumber}</span>
                              {order.patient.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="size-3" />
                                  {order.patient.phone}
                                </span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <Calendar className="size-3" />
                                {date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-bold tabular-nums text-ink-950">
                              {inr(totalAmt)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                              <span
                                className={`rounded-sm px-1.5 py-0.5 font-medium ${
                                  balAmt > 0 ? "bg-red-50 text-status-critical" : "bg-green-50 text-status-normal"
                                }`}
                              >
                                {balAmt > 0 ? `Due ${inr(balAmt)}` : "Paid"}
                              </span>
                              <span className="text-ink-400">
                                {completedTests}/{testCount}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
