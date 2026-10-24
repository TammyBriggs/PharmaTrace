import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Pass null to skip the request (e.g. a role that has no data for this page).
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null, error: null, loading: path !== null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api<T>(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
