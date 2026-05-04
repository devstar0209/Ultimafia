import { useEffect, useState } from "react";

export const useNow = (refreshFrequency) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) setNow(Date.now());
    }, refreshFrequency);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshFrequency]);

  return now;
};
