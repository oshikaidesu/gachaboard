"use client";

import { useEffect, useState, useCallback } from "react";
import type { ApiWorkspace } from "@shared/apiTypes";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";

export function useWorkspaces(e2eHeaders?: E2EHeaders | null) {
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces?includeDeleted=1", {
        headers: withE2EHeaders({}, e2eHeaders),
      });
      if (res.ok) setWorkspaces(await res.json());
    } finally {
      setLoading(false);
    }
  }, [e2eHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  return { workspaces, loading, load };
}
