import "./index.css";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import { LoadingState } from "./components/ui/PageStates";

// Eager — first-paint and auth-critical (small).
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Route-level code splitting — each page loads in its own chunk on demand.
const PatientRegistrationPage = lazy(() => import("./pages/PatientRegistrationPage"));
const PatientRegistrationFlow = lazy(() => import("./pages/PatientRegistrationFlow"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const TestResultPage = lazy(() => import("./pages/TestResultPage"));
const QcPage = lazy(() => import("./pages/QcPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PatientsPage = lazy(() => import("./pages/PatientsPage"));
const PatientFormPage = lazy(() => import("./pages/PatientFormPage"));
const PatientDetailPage = lazy(() => import("./pages/PatientDetailPage"));
const MastersPage = lazy(() => import("./pages/MastersPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const PathologistReviewPage = lazy(() => import("./pages/PathologistReviewPage"));
const MobileReviewPage = lazy(() => import("./pages/MobileReviewPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const InvoicePage = lazy(() => import("./pages/InvoicePage"));
// Print-optimized stages — tiny dedicated chunks, rendered without the app
// shell so the PDF/paper output is a clean A4 document.
const PrintReportPage = lazy(() => import("./pages/PrintReportPage"));
const PrintInvoicePage = lazy(() => import("./pages/PrintInvoicePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const GeneralSettingsPage = lazy(() => import("./pages/GeneralSettingsPage"));
const SystemSettingsPage = lazy(() => import("./pages/SystemSettingsPage"));
const PartiesPage = lazy(() => import("./pages/PartiesPage"));
const PartyFormPage = lazy(() => import("./pages/PartyFormPage"));
const PartyPricingPage = lazy(() => import("./pages/PartyPricingPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const VerifyReportPage = lazy(() => import("./pages/VerifyReportPage"));
const PortalOrdersPage = lazy(() => import("./pages/PortalOrdersPage"));
const PortalReportPage = lazy(() => import("./pages/PortalReportPage"));

const shell = (page: React.ReactNode) => <AppShell>{page}</AppShell>;

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingState label="Loading…" rows={2} />}>
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
            element={<ProtectedRoute>{shell(<Navigate to="/masters/parameters" replace />)}</ProtectedRoute>}
          />
          <Route
            path="/masters/:section"
            element={<ProtectedRoute>{shell(<MastersPage />)}</ProtectedRoute>}
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
            path="/qc"
            element={<ProtectedRoute>{shell(<QcPage />)}</ProtectedRoute>}
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
            path="/print/report/:orderId"
            element={
              <ProtectedRoute>
                <PrintReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/print/invoice/:orderId"
            element={
              <ProtectedRoute>
                <PrintInvoicePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={<ProtectedRoute>{shell(<ReportsPage />)}</ProtectedRoute>}
          />
          <Route path="/settings" element={<Navigate to="/general-settings" replace />} />
          <Route
            path="/general-settings"
            element={<ProtectedRoute>{shell(<Navigate to="/general-settings/lab" replace />)}</ProtectedRoute>}
          />
          <Route
            path="/general-settings/:section"
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
            element={<ProtectedRoute>{shell(<Navigate to="/inventory/items" replace />)}</ProtectedRoute>}
          />
          <Route
            path="/inventory/:section"
            element={<ProtectedRoute>{shell(<InventoryPage />)}</ProtectedRoute>}
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
