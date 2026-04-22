import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminAccessGate from "./components/auth/AdminAccessGate";
import AdminNotFoundPage from "./components/auth/AdminNotFoundPage";
import AdminLayout from "./layouts/AdminLayout";

function App() {
  return (
    <AdminAccessGate>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/overview" element={<AdminLayout />} />
        <Route path="/admin/users/:page" element={<AdminLayout />} />
        <Route path="/admin/games/:page" element={<AdminLayout />} />
        <Route path="/admin/catalog/:page" element={<AdminLayout />} />
        <Route path="/admin/settings/:page" element={<AdminLayout />} />
        <Route path="*" element={<AdminNotFoundPage />} />
      </Routes>
    </AdminAccessGate>
  );
}

export default App;
