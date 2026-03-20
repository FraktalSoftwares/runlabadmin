import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { PermissionKey } from "@/lib/permissions";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

export function usePermissions() {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = profile?.tipo_user === "Administrador";

  const fetchPermissions = useCallback(() => {
    if (!user?.id || !isAdmin) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from("admin_permissions")
      .select("permission_key")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!error && data) {
          setPermissions(data.map((r) => r.permission_key));
        } else {
          setPermissions([]);
        }
        setIsLoading(false);
      });
  }, [user?.id, isAdmin]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  useRealtimeRefetch(["admin_permissions"], fetchPermissions);

  const hasPermission = useCallback(
    (key: string): boolean => permissions.includes(key),
    [permissions]
  );

  return {
    permissions,
    hasPermission,
    isLoading,
    isAdmin: !!isAdmin,
  };
}
