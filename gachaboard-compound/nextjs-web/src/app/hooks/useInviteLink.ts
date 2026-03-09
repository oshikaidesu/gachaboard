"use client";

import { useEffect, useState, useCallback } from "react";
import { useCopyToClipboard } from "usehooks-ts";

export function useInviteLink(workspaceId: string) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/invite`)
      .then((res) => (res.ok ? res.json() : { inviteUrl: null }))
      .then((data) => setInviteUrl(data.inviteUrl))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const createOrReset = useCallback(async () => {
    setCreating(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/invite`, { method: "POST" });
    if (res.ok) {
      const { inviteUrl: url } = await res.json();
      setInviteUrl(url);
      if (url) copyToClipboard(url);
    }
    setCreating(false);
  }, [workspaceId, copyToClipboard]);

  const copy = useCallback(() => {
    if (inviteUrl) copyToClipboard(inviteUrl);
  }, [inviteUrl, copyToClipboard]);

  return {
    inviteUrl,
    loading,
    creating,
    copiedText,
    createOrReset,
    copy,
  };
}
