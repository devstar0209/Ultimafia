import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { getAdminSession } from "../../services/adminService";
import AdminNotFoundPage from "./AdminNotFoundPage";

export default function AdminAccessGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getAdminSession();
      if (data?.user?.csrf) {
        axios.defaults.headers.common["x-csrf"] = data.user.csrf;
      }
      setAllowed(Boolean(data?.user?.admin));
    } catch (error) {
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return <AdminNotFoundPage loading />;
  }

  if (!allowed) {
    return <AdminNotFoundPage />;
  }

  return children;
}
