import { useCallback, useEffect, useState } from "react";

export default function useAdminQuery(queryFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      setData(result);
      return result;
    } catch (queryError) {
      setError(queryError);
      throw queryError;
    } finally {
      setLoading(false);
    }
  }, [queryFn]);

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

  return { data, loading, error, refetch };
}
