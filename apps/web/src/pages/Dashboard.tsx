import { useNavigate } from "react-router-dom";
import {
  FlaskConical,
  LogOut,
  Users,
  Beaker,
  FileText,
  Activity,
  ClipboardList,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  const stats = [
    { label: "Pending Verification", value: "--", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Critical Alerts", value: "--", color: "text-red-600", bg: "bg-red-50" },
    { label: "Today's Samples", value: "--", color: "text-teal-600", bg: "bg-teal-50" },
    { label: "TAT Compliance", value: "--", color: "text-blue-600", bg: "bg-blue-50" },
  ];

  const quickActions = [
    { icon: ClipboardList, label: "New Order", desc: "Register a new test order" },
    { icon: Beaker, label: "Result Entry", desc: "Enter test results" },
    { icon: FileText, label: "Reports", desc: "View & generate reports" },
    { icon: Users, label: "Patients", desc: "Manage patient records" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
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
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Activity className={`size-5 ${stat.color}`} />
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
            {quickActions.map((action) => (
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
                <p className="text-xs text-gray-500 mt-1">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h2>
            <Settings className="size-5 text-gray-300" />
          </div>
          <div className="text-center py-12 text-gray-400">
            <ClipboardList className="size-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No recent activity to display</p>
            <p className="text-xs mt-1">
              Complete your first sample registration to see activity here
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
