import "./index.css";
import { Routes, Route } from "react-router";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientRegistrationPage from "./pages/PatientRegistrationPage";
import PatientRegistrationFlow from "./pages/PatientRegistrationFlow";
import OrdersPage from "./pages/OrdersPage";
import TestResultPage from "./pages/TestResultPage";
import Dashboard from "./pages/Dashboard";
import PatientsPage from "./pages/PatientsPage";
import PatientFormPage from "./pages/PatientFormPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import MastersPage from "./pages/MastersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import StaffPage from "./pages/StaffPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import PathologistReviewPage from "./pages/PathologistReviewPage";
import MobileReviewPage from "./pages/MobileReviewPage";
import AlertsPage from "./pages/AlertsPage";
import VerifyPage from "./pages/VerifyPage";
import ReportPage from "./pages/ReportPage";
import InvoicePage from "./pages/InvoicePage";
import ReportsPage from "./pages/ReportsPage";
import LabSettingsPage from "./pages/LabSettingsPage";
import GeneralSettingsPage from "./pages/GeneralSettingsPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import PartiesPage from "./pages/PartiesPage";
import PartyFormPage from "./pages/PartyFormPage";
import PartyPricingPage from "./pages/PartyPricingPage";
import InventoryPage from "./pages/InventoryPage";
import VerifyReportPage from "./pages/VerifyReportPage";
import PortalOrdersPage from "./pages/PortalOrdersPage";
import PortalReportPage from "./pages/PortalReportPage";

const shell = (page: React.ReactNode) => <AppShell>{page}</AppShell>;

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-report" element={<VerifyReportPage />} />
        <Route
          path="/portal/patient"
          element={
            <ProtectedRoute>
              <PortalOrdersPage kind="patient" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portal/referrer"
          element={
            <ProtectedRoute>
              <PortalOrdersPage kind="referrer" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portal/:kind/report/:orderId"
          element={
            <ProtectedRoute>
              <PortalReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute>{shell(<Dashboard />)}</ProtectedRoute>}
        />
        <Route
          path="/alerts"
          element={<ProtectedRoute>{shell(<AlertsPage />)}</ProtectedRoute>}
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
          path="/patients/:id"
          element={<ProtectedRoute>{shell(<PatientDetailPage />)}</ProtectedRoute>}
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
          path="/patient-registration"
          element={<ProtectedRoute>{shell(<PatientRegistrationFlow />)}</ProtectedRoute>}
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
          path="/approvals/:id"
          element={<ProtectedRoute>{shell(<PathologistReviewPage />)}</ProtectedRoute>}
        />
        <Route
          path="/mobile-review"
          element={<ProtectedRoute>{shell(<MobileReviewPage />)}</ProtectedRoute>}
        />
        <Route
          path="/orders/:orderId/report"
          element={<ProtectedRoute>{shell(<ReportPage />)}</ProtectedRoute>}
        />
        <Route
          path="/orders/:orderId/invoice"
          element={<ProtectedRoute>{shell(<InvoicePage />)}</ProtectedRoute>}
        />
        <Route
          path="/reports"
          element={<ProtectedRoute>{shell(<ReportsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute>{shell(<LabSettingsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/general-settings"
          element={<ProtectedRoute>{shell(<GeneralSettingsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/system-settings"
          element={<ProtectedRoute>{shell(<SystemSettingsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/parties"
          element={<ProtectedRoute>{shell(<PartiesPage />)}</ProtectedRoute>}
        />
        <Route
          path="/parties/new"
          element={<ProtectedRoute>{shell(<PartyFormPage />)}</ProtectedRoute>}
        />
        <Route
          path="/parties/:id/edit"
          element={<ProtectedRoute>{shell(<PartyFormPage />)}</ProtectedRoute>}
        />
        <Route
          path="/parties/:id/pricing"
          element={<ProtectedRoute>{shell(<PartyPricingPage />)}</ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={<ProtectedRoute>{shell(<InventoryPage />)}</ProtectedRoute>}
        />
      </Routes>
    </AuthProvider>
  );
}
