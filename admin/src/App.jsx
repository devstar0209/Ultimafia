import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminAccessGate from "./components/auth/AdminAccessGate";
import AdminNotFoundPage from "./components/auth/AdminNotFoundPage";
import AdminLayout from "./layouts/AdminLayout";

function App() {
  return (
    <AdminAccessGate>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<AdminLayout />} />
        <Route path="/users/:page" element={<AdminLayout />} />
        <Route path="/games/:page" element={<AdminLayout />} />
        <Route path="/catalog/:page" element={<AdminLayout />} />
        <Route path="/settings/:page" element={<AdminLayout />} />
        <Route path="*" element={<AdminNotFoundPage />} />
      </Routes>
    </AdminAccessGate>
  );
}

export default App;
