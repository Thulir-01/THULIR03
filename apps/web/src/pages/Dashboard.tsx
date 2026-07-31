import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  FlaskConical,
  LogOut,
  Users,
  Beaker,
  ClipboardList,
  User,
  Stethoscope,
  FilePlus2,
  Phone,
  Calendar,
  ArrowRight,
  History,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { getDashboardStats, type DashboardStats, type OrderListItem } from "../lib/api-client";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    getDashboardStats().then((data) => {
      setStats(data);
      setRecentOrders(data.recentOrders);
    }).catch(() => {
      setStats(null);
      setRecentOrders([]);
    }).finally(() => setOrdersLoading(false));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const roleName =
    user?.role === "lab_admin"
      ? "Lab Admin"
      : user?.role === "pathologist"
      ? "Pathologist"
      : user?.role === "technician"
      ? "Technician"
      : user?.role;

  // Server-computed COUNT stats — one lightweight request, no full fetches.
  const totalOrders = stats?.totalOrders ?? 0;
  const pendingTests = stats?.pendingTests ?? 0;
  const todayRevenue = stats?.todayRevenue ?? 0;
  const patientCount = stats?.totalPatients ?? 0;

  const statsCards = [
    { label: "Total Orders", value: String(totalOrders), color: "text-teal-600", bg: "bg-teal-50", icon: ClipboardList },
    { label: "Total Patients", value: String(patientCount), color: "text-blue-600", bg: "bg-blue-50", icon: Users },
    { label: "Pending Tests", value: String(pendingTests), color: "text-amber-600", bg: "bg-amber-50", icon: Beaker },
    { label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, color: "text-cyan-600", bg: "bg-cyan-50", icon: ClipboardList },
  ];

  const quickActions = [
    { icon: FilePlus2, label: "New Registration", desc: "Full-screen patient registration with billing", to: "/registration", primary: true },
    { icon: ClipboardList, label: "Orders", desc: "View all lab orders", to: "/orders" },
    { icon: Beaker, label: "Result Entry", desc: "Enter test results", to: "/results" },
    { icon: Users, label: "Patients", desc: "Manage patient records", to: "/patients" },
    { icon: Stethoscope, label: "Referrers", desc: "Manage referring doctors", to: "/referrers" },
    { icon: History, label: "Audit Trail", desc: "Browse all activity logs", to: "/audit" },
  ];

  // Add missing import for Stethoscope

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <FlaskConical className="size-5" />
            </div>
            <span className="font-semibold text-gray-900">THULIR03</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User className="size-4" />
              <span>
                {user?.firstName} {user?.lastName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                {roleName}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Sign out"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-gray-500 mt-1">
            Here's your lab overview for today
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`size-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) =>
              action.to && action.to !== "#" ? (
                <Link
                  key={action.label}
                  to={action.to}
                  className={`bg-white rounded-xl border p-5 text-left hover:shadow-sm transition-all group block ${
                    action.primary
                      ? "border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 shadow-md shadow-teal-100"
                      : "border-gray-100 hover:border-teal-200"
                  }`}
                >
                  <div className="size-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:bg-teal-100 transition-colors">
                    <action.icon className="size-5" />
                  </div>
                  <h3 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{action.desc}</p>
                </Link>
              ) : (
                <button
                  key={action.label}
                  className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:border-teal-200 hover:shadow-sm transition-all group cursor-pointer"
                >
                <div className="size-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:bg-teal-100 transition-colors">
                  <action.icon className="size-5" />
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">
                  {action.label}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{action.desc}</p>                </button>
              )
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Orders
            </h2>
            <Link to="/orders"
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 transition-colors">
              View All <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList className="size-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent orders</p>
              <p className="text-xs mt-1">Register a patient to create your first order</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order) => {
                const totalAmt = parseFloat(order.totalAmount || "0");
                const balAmt = parseFloat(order.balanceAmount || "0");
                const testCount = order.tests.length;
                const completedTests = order.tests.filter(t => t.status === "completed").length;
                const date = new Date(order.createdAt);

                return (
                  <div key={order.id}
                    className="flex items-center justify-between py-3 hover:bg-gray-50/50 px-2 -mx-2 rounded-lg transition-colors group cursor-pointer"
                    onClick={() => navigate("/orders")}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                        {order.patient.firstName.charAt(0)}{order.patient.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {order.patient.firstName} {order.patient.lastName}
                          </span>
                          {order.emergency && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium shrink-0">
                              EMERGENCY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                          <span className="font-mono font-medium text-teal-600">{order.orderNumber}</span>
                          {order.patient.phone && (
                            <span className="flex items-center gap-0.5"><Phone className="size-3" />{order.patient.phone}</span>
                          )}
                          <span className="flex items-center gap-0.5"><Calendar className="size-3" />{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-gray-900">₹{totalAmt.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                        <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${
                            balAmt > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          }`}>
                            {balAmt > 0 ? `Due ₹${balAmt.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : "Paid"}
                          </span>
                          <span className="text-gray-400">{completedTests}/{testCount}</span>
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-gray-200 group-hover:text-teal-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
