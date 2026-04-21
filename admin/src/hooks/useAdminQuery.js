import { useEffect, useState } from "react";

export default function useAdminQuery(queryFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function runQuery() {
      setLoading(true);
      setError(null);

      try {
        const result = await queryFn();
        if (!mounted) return;
        setData(result);
      } catch (queryError) {
        if (!mounted) return;
        setError(queryError);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    runQuery();

    return () => {
      mounted = false;
    };
  }, [queryFn]);

  return { data, loading, error };
}
