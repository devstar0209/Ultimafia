import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<AdminLayout />} />
      <Route path="/users/:page" element={<AdminLayout />} />
      <Route path="/games/:page" element={<AdminLayout />} />
      <Route path="/catalog/:page" element={<AdminLayout />} />
      <Route path="/settings/:page" element={<AdminLayout />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

export default App;
