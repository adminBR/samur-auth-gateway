// src/App.tsx
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AuthAnalyticsPage from "./pages/AuthAnalyticsPage";
import NotFoundPage from "./pages/NotFoundPage";
import UserManagementPage from "./pages/UserManagementPage";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PrivateRoute from "./routes/PrivateRoute";

function App() {
  return (
    <div>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/auth-analytics"
            element={
              <PrivateRoute>
                <AuthAnalyticsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute>
                <UserManagementPage />
              </PrivateRoute>
            }
          />

          {/* 1. This catches any path that wasn't matched above */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
