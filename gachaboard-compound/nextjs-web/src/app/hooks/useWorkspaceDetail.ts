"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ApiBoard, ApiWorkspaceInfo, ApiWorkspaceMember } from "@shared/apiTypes";

export function useWorkspaceDetail(workspaceId: string) {
  const router = useRouter();
  const [wsInfo, setWsInfo] = useState<ApiWorkspaceInfo | null>(null);
  const [members, setMembers] = useState<ApiWorkspaceMember[]>([]);
  const [canKick, setCanKick] = useState(false);
  const [boards, setBoards] = useState<ApiBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, boardsRes, membersRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}`),
        fetch(`/api/workspaces/${workspaceId}/boards?includeDeleted=1`),
        fetch(`/api/workspaces/${workspaceId}/members`),
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
  }, [workspaceId, router]);

  useEffect(() => {
    load();
  }, [load]);

  return { wsInfo, members, canKick, boards, loading, load };
}
