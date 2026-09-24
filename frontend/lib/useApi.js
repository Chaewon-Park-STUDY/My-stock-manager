"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * 화면이 열릴 때 API를 불러오고, reload()로 다시 불러오는 훅.
 * const { data, error, loading, reload } = useApi(() => api.accounts.list(), []);
 */
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetcher();
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState({ data: null, error: e.message, loading: false });
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/** 저장 성공/실패 메시지를 잠깐 보여주는 훅 */
export function useFlash() {
  const [flash, setFlash] = useState(null);
  const show = useCallback((text, kind = "ok") => {
    setFlash({ text, kind, id: Date.now() });
    setTimeout(() => setFlash((f) => (f && f.text === text ? null : f)), 3000);
  }, []);
  return [flash, show];
}
