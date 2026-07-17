import React, { Component } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";

import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import GuardsPage from "./pages/admin/GuardsPage";
import ProjectsPage from "./pages/admin/ProjectsPage";
import ReportPage from "./pages/admin/ReportPage";
import AdminEditAttendancePage from "./pages/admin/AdminEditAttendancePage";

import SalarySheetPage from "./pages/admin/SalarySheetPage";
import QuotationGeneratorPage from "./pages/admin/QuotationGeneratorPage";
import FinalAgreementGeneratorPage from "./pages/admin/FinalAgreementGeneratorPage";

import GuardLayout from "./layouts/GuardLayout";
import MarkAttendancePage from "./pages/guard/MarkAttendancePage";
import MyRecordPage from "./pages/guard/MyRecordPage";

class GlobalErrorCatcher extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.toString() };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "50px",
            fontFamily: "sans-serif",
            textAlign: "center",
          }}
        >
          <h1
            style={{ color: "#ef4444", fontSize: "32px", marginBottom: "10px" }}
          >
            ⚠️ App Crashed
          </h1>
          <div
            style={{
              background: "#f1f5f9",
              padding: "20px",
              borderRadius: "8px",
              display: "inline-block",
              color: "#0f172a",
              fontWeight: "bold",
            }}
          >
            {this.state.errorMessage}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <GlobalErrorCatcher>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRole="admin" />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/guards" element={<GuardsPage />} />
                <Route path="/admin/projects" element={<ProjectsPage />} />
                <Route path="/admin/report" element={<ReportPage />} />
                <Route
                  path="/admin/edit-attendance"
                  element={<AdminEditAttendancePage />}
                />

                <Route
                  path="/admin/salary-sheet"
                  element={<SalarySheetPage />}
                />
                <Route
                  path="/admin/quotation-generator"
                  element={<QuotationGeneratorPage />}
                />
                <Route
                  path="/admin/final-agreement"
                  element={<FinalAgreementGeneratorPage />}
                />
              </Route>
            </Route>

            {/* Guard Routes */}
            <Route element={<ProtectedRoute allowedRole="guard" />}>
              <Route element={<GuardLayout />}>
                <Route
                  path="/guard/mark-attendance"
                  element={<MarkAttendancePage />}
                />
                <Route path="/guard/my-record" element={<MyRecordPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorCatcher>
  );
}