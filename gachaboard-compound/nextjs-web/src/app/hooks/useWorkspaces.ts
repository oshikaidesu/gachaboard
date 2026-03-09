"use client";

import { useEffect, useState, useCallback } from "react";
import type { ApiWorkspace } from "@shared/apiTypes";

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces?includeDeleted=1");
      if (res.ok) setWorkspaces(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { workspaces, loading, load };
}
