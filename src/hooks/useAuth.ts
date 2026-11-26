import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const me = trpc.files.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (!me.isLoading) setLoading(false);
  }, [me.isLoading]);

  const user = me.data ?? null;
  return {
    user,
    loading,
    isLoading: me.isLoading,
    isAuthenticated: !!user,
  };
}

export async function apiLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export const logout = apiLogout;
