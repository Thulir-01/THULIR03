import "./index.css";
import { Routes, Route } from "react-router";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientRegistrationPage from "./pages/PatientRegistrationPage";
import OrdersPage from "./pages/OrdersPage";
import TestResultPage from "./pages/TestResultPage";
import Dashboard from "./pages/Dashboard";
import PatientsPage from "./pages/PatientsPage";
import PatientFormPage from "./pages/PatientFormPage";
import ReferrersPage from "./pages/ReferrersPage";
import ReferrerFormPage from "./pages/ReferrerFormPage";
import ReferrerPricingPage from "./pages/ReferrerPricingPage";
import MastersPage from "./pages/MastersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import StaffPage from "./pages/StaffPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import VerifyPage from "./pages/VerifyPage";
import ReportPage from "./pages/ReportPage";

const shell = (page: React.ReactNode) => <AppShell>{page}</AppShell>;

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute>{shell(<Dashboard />)}</ProtectedRoute>}
        />
        <Route
          path="/patients"
          element={<ProtectedRoute>{shell(<PatientsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/patients/new"
          element={<ProtectedRoute>{shell(<PatientFormPage />)}</ProtectedRoute>}
        />
        <Route
          path="/referrers"
          element={<ProtectedRoute>{shell(<ReferrersPage />)}</ProtectedRoute>}
        />
        <Route
          path="/referrers/new"
          element={<ProtectedRoute>{shell(<ReferrerFormPage />)}</ProtectedRoute>}
        />
        <Route
          path="/referrers/:id/pricing"
          element={<ProtectedRoute>{shell(<ReferrerPricingPage />)}</ProtectedRoute>}
        />
        <Route
          path="/masters"
          element={<ProtectedRoute>{shell(<MastersPage />)}</ProtectedRoute>}
        />
        <Route
          path="/masters/parameters"
          element={<ProtectedRoute>{shell(<MastersPage initialTab="parameters" />)}</ProtectedRoute>}
        />
        <Route
          path="/masters/packages"
          element={<ProtectedRoute>{shell(<MastersPage initialTab="packages" />)}</ProtectedRoute>}
        />
        <Route
          path="/registration"
          element={<ProtectedRoute>{shell(<PatientRegistrationPage />)}</ProtectedRoute>}
        />
        <Route
          path="/orders"
          element={<ProtectedRoute>{shell(<OrdersPage />)}</ProtectedRoute>}
        />
        <Route
          path="/results"
          element={<ProtectedRoute>{shell(<TestResultPage />)}</ProtectedRoute>}
        />
        <Route
          path="/audit"
          element={<ProtectedRoute>{shell(<AuditLogsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/staff"
          element={<ProtectedRoute>{shell(<StaffPage />)}</ProtectedRoute>}
        />
        <Route
          path="/verify"
          element={<ProtectedRoute>{shell(<VerifyPage />)}</ProtectedRoute>}
        />
        <Route
          path="/approvals"
          element={<ProtectedRoute>{shell(<ApprovalsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/orders/:orderId/report"
          element={<ProtectedRoute>{shell(<ReportPage />)}</ProtectedRoute>}
        />
      </Routes>
    </AuthProvider>
  );
}
