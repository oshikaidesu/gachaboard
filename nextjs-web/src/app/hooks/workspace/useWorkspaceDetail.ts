"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ApiBoard, ApiWorkspaceInfo, ApiWorkspaceMember } from "@shared/apiTypes";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";

export function useWorkspaceDetail(workspaceId: string, e2eHeaders?: E2EHeaders | null) {
  const router = useRouter();
  const [wsInfo, setWsInfo] = useState<ApiWorkspaceInfo | null>(null);
  const [members, setMembers] = useState<ApiWorkspaceMember[]>([]);
  const [canKick, setCanKick] = useState(false);
  const [boards, setBoards] = useState<ApiBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = withE2EHeaders({}, e2eHeaders);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, boardsRes, membersRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}`, { headers }),
        fetch(`/api/workspaces/${workspaceId}/boards?includeDeleted=1`, { headers }),
        fetch(`/api/workspaces/${workspaceId}/members`, { headers }),
      ]);
      if (wsRes.status === 401 || boardsRes.status === 401) {
        router.replace("/");
        return;
      }
      if (wsRes.status === 403 || boardsRes.status === 403) {
        router.replace("/access-denied");
        return;
      }
      if (wsRes.status === 404 || boardsRes.status === 404) {
        router.replace("/workspaces");
        return;
      }
      if (wsRes.ok) setWsInfo(await wsRes.json());
      if (boardsRes.ok) setBoards(await boardsRes.json());
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
        setCanKick(data.canKick ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router, e2eHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  return { wsInfo, members, canKick, boards, loading, load };
}
