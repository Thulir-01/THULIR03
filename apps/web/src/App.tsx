import "./index.css";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
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
import AuditLogsPage from "./pages/AuditLogsPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/new"
          element={
            <ProtectedRoute>
              <PatientFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrers"
          element={
            <ProtectedRoute>
              <ReferrersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrers/new"
          element={
            <ProtectedRoute>
              <ReferrerFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registration"
          element={
            <ProtectedRoute>
              <PatientRegistrationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <TestResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
