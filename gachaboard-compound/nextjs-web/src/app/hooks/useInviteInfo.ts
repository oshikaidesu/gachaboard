"use client";

import { useEffect, useState } from "react";

export type InviteInfo = {
  workspaceId: string;
  workspaceName: string;
};

export function useInviteInfo(token: string) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/invite/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "招待リンクが無効です" : "エラーが発生しました");
        return res.json();
      })
      .then((data) => {
        setInfo(data);
        setError(null);
      })
      .catch((e) => {
        setError(e.message);
        setInfo(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return { info, error, loading };
}
