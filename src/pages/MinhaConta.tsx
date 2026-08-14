import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { AddUserSheet } from "@/components/AddUserSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, User, Mail, Briefcase, Lock, Eye, EyeOff, ChevronLeft, UserPlus, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import {
  PERMISSION_GROUPS,
  getPermissionLabel,
  type PermissionKey,
} from "@/lib/permissions";
import { toast } from "sonner";

type AdminRemovalStatus = "indeterminate" | "removable" | "protected" | "removed";

type AdminListItem = {
  id: string;
  full_name: string | null;
  email: string | null;
  removal_status: AdminRemovalStatus | null;
  can_remove: boolean;
};

type RemoveAdminSuccess = {
  status: "removed" | "already_removed";
  request_id: string;
  target_user_id: string;
};

type RemoveAdminErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "TARGET_NOT_FOUND"
  | "SELF_REMOVAL_FORBIDDEN"
  | "LAST_ADMIN_FORBIDDEN"
  | "ADMIN_RECONCILIATION_PENDING"
  | "ADMIN_PROTECTED"
  | "REMOVAL_CONFLICT"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

type RemovalAttempt = {
  actorUserId: string;
  targetUserId: string;
  requestId: string;
  removalConfirmed: boolean;
};

const REMOVAL_ATTEMPTS_STORAGE_KEY = "runlab-admin-removal-attempts";

const REMOVE_ADMIN_ERROR_MESSAGES: Record<RemoveAdminErrorCode, string> = {
  INVALID_REQUEST: "A solicitação de remoção é inválida. Atualize a página e tente novamente.",
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente para continuar.",
  FORBIDDEN: "Você não tem permissão para remover administradores.",
  TARGET_NOT_FOUND: "Administrador não encontrado. Atualize a lista e tente novamente.",
  SELF_REMOVAL_FORBIDDEN: "Você não pode remover sua própria conta administrativa.",
  LAST_ADMIN_FORBIDDEN: "Não é possível remover o último administrador.",
  ADMIN_RECONCILIATION_PENDING: "Este administrador aguarda reconciliação e não pode ser removido.",
  ADMIN_PROTECTED: "Este administrador está protegido e não pode ser removido.",
  REMOVAL_CONFLICT: "A remoção entrou em conflito com outra operação. Atualize a lista e tente novamente.",
  METHOD_NOT_ALLOWED: "A remoção não está disponível nesta versão. Atualize a página e tente novamente.",
  INTERNAL_ERROR: "Não foi possível remover o administrador. Tente novamente.",
};

const isRemoveAdminErrorCode = (value: unknown): value is RemoveAdminErrorCode =>
  typeof value === "string" && value in REMOVE_ADMIN_ERROR_MESSAGES;

const getRemoveAdminErrorMessage = async (error: unknown): Promise<string> => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (isRemoveAdminErrorCode(body.error)) {
        return REMOVE_ADMIN_ERROR_MESSAGES[body.error];
      }
    } catch {
      // A resposta pode não ser JSON em falhas de rede ou gateway.
    }
  }

  return "Não foi possível confirmar a remoção. Tente novamente.";
};

const getRemovalStatusLabel = (
  admin: AdminListItem | undefined,
  isSelf: boolean,
): string => {
  if (isSelf) return "Sua própria conta não pode ser removida.";
  if (!admin) return "Status de remoção indisponível.";

  switch (admin.removal_status) {
    case "removable":
      return admin.can_remove
        ? "Administrador elegível para remoção."
        : "Este administrador não pode ser removido no momento.";
    case "indeterminate":
      return "Reconciliação pendente. A remoção está bloqueada.";
    case "protected":
      return "Administrador protegido. A remoção está bloqueada.";
    case "removed":
      return "A remoção deste administrador já foi concluída.";
    default:
      return "Status de remoção indisponível. A remoção está bloqueada.";
  }
};

const getRemovalBlockedMessage = (admin: AdminListItem): string => {
  switch (admin.removal_status) {
    case "indeterminate":
      return REMOVE_ADMIN_ERROR_MESSAGES.ADMIN_RECONCILIATION_PENDING;
    case "protected":
      return REMOVE_ADMIN_ERROR_MESSAGES.ADMIN_PROTECTED;
    default:
      return "Este administrador não pode ser removido no momento.";
  }
};

const loadRemovalAttempts = (): Map<string, RemovalAttempt> => {
  if (typeof window === "undefined") return new Map();

  try {
    const stored = window.sessionStorage.getItem(REMOVAL_ATTEMPTS_STORAGE_KEY);
    if (!stored) return new Map();

    const attempts = JSON.parse(stored) as RemovalAttempt[];
    if (!Array.isArray(attempts)) return new Map();

    return new Map(
      attempts
        .filter(
          (attempt) =>
            typeof attempt?.actorUserId === "string" &&
            typeof attempt?.targetUserId === "string" &&
            typeof attempt?.requestId === "string" &&
            typeof attempt?.removalConfirmed === "boolean",
        )
        .map((attempt) => [attempt.targetUserId, attempt]),
    );
  } catch (error) {
    console.warn("Não foi possível restaurar tentativas de remoção.", error);
    return new Map();
  }
};

const persistRemovalAttempts = (
  attempts: Map<string, RemovalAttempt>,
): boolean => {
  if (typeof window === "undefined") return false;

  try {
    if (attempts.size === 0) {
      window.sessionStorage.removeItem(REMOVAL_ATTEMPTS_STORAGE_KEY);
      return true;
    }

    window.sessionStorage.setItem(
      REMOVAL_ATTEMPTS_STORAGE_KEY,
      JSON.stringify(Array.from(attempts.values())),
    );
    return true;
  } catch (error) {
    console.warn("Não foi possível persistir a tentativa de remoção.", error);
    return false;
  }
};

const MinhaConta = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signOut, loading, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("dados-basicos");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isAddUserSheetOpen, setIsAddUserSheetOpen] = useState(false);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const [adminList, setAdminList] = useState<AdminListItem[]>([]);
  const [adminListLoading, setAdminListLoading] = useState(false);
  const [selectedUserPerms, setSelectedUserPerms] = useState<string[]>([]);
  const [selectedUserPermsLoaded, setSelectedUserPermsLoaded] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [excludingUserId, setExcludingUserId] = useState<string | null>(null);
  const removalAttemptsRef = useRef<Map<string, RemovalAttempt> | null>(null);
  const [termosUso, setTermosUso] = useState<string | null>(null);
  const [politicaPrivacidade, setPoliticaPrivacidade] = useState<string | null>(null);
  const [sobreLoading, setSobreLoading] = useState(false);

  const [formFullName, setFormFullName] = useState("");
  const [formCargo, setFormCargo] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl =
    profile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string) ||
    (user?.user_metadata?.picture as string) ||
    undefined;
  const cargo =
    (user?.user_metadata?.cargo as string) ||
    (user?.user_metadata?.role as string) ||
    "";
  
  useEffect(() => {
    const tab = searchParams.get("tab");
    const edit = searchParams.get("edit");
    
    if (tab === "acessos" || tab === "sobre") {
      setActiveTab(tab);
      setIsEditing(false);
    } else if (edit === "true") {
      // Configurações: go to dados-basicos with editing active
      setActiveTab("dados-basicos");
      setIsEditing(true);
    } else {
      // Default: dados-basicos without editing
      setActiveTab("dados-basicos");
      setIsEditing(false);
    }
  }, [searchParams]);
  
  const canEditAcessos = hasPermission("acessos.edit");

  const fetchAdminList = useCallback(async (): Promise<AdminListItem[]> => {
    const { data, error } = await supabase.rpc("get_admin_list");
    if (error) throw error;

    const admins = (data ?? []) as AdminListItem[];
    setAdminList(admins);
    return admins;
  }, []);

  const fetchAdminListForRemoval = useCallback(async (): Promise<AdminListItem[]> => {
    try {
      return await fetchAdminList();
    } catch {
      throw new Error(
        "Não foi possível confirmar o estado do administrador. Tente novamente.",
      );
    }
  }, [fetchAdminList]);

  useEffect(() => {
    if (!permissionsLoading && activeTab === "acessos" && !hasPermission("acessos.view")) {
      setActiveTab("dados-basicos");
    }
  }, [activeTab, hasPermission, permissionsLoading]);

  useEffect(() => {
    if (activeTab === "acessos" && hasPermission("acessos.view")) {
      setAdminListLoading(true);
      fetchAdminList()
        .catch(() => setAdminList([]))
        .finally(() => setAdminListLoading(false));
    }
  }, [activeTab, fetchAdminList, hasPermission]);

  useEffect(() => {
    if (activeTab === "sobre") {
      setSobreLoading(true);
      supabase
        .from("app")
        .select("termos_uso, politica_privacidade")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setTermosUso(data?.termos_uso ?? null);
          setPoliticaPrivacidade(data?.politica_privacidade ?? null);
          setSobreLoading(false);
        });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "dados-basicos" && isEditing) {
      setIsEditing(false);
    }
    if (activeTab !== "acessos" && selectedUserId) {
      setSelectedUserId(null);
    }
  }, [activeTab, isEditing, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId || activeTab !== "acessos") {
      setSelectedUserPermsLoaded(false);
      return;
    }
    setSelectedUserPermsLoaded(false);
    supabase
      .from("admin_permissions")
      .select("permission_key")
      .eq("user_id", selectedUserId)
      .then(({ data }) => {
        const keys = (data ?? []).map((r) => r.permission_key);
        setSelectedUserPerms(keys);
        setSelectedUserPermsLoaded(true);
      });
  }, [selectedUserId, activeTab]);

  const handleSavePermissions = async () => {
    if (!selectedUserId || !canEditAcessos) return;
    if (!selectedUserPermsLoaded) {
      toast.error("Aguarde o carregamento das permissões.");
      return;
    }
    if (selectedUserPerms.length === 0) {
      toast.error("Selecione ao menos uma permissão para salvar.");
      return;
    }
    setSavingPerms(true);
    try {
      const { error } = await supabase.rpc("replace_admin_permissions", {
        target_user_id: selectedUserId,
        permission_keys: selectedUserPerms,
      });
      if (error) throw error;
      toast.success("Permissões atualizadas.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSavingPerms(false);
    }
  };

  const togglePerm = (key: PermissionKey) => {
    setSelectedUserPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExcluirAdmin = async (targetId: string) => {
    const targetAdmin = adminList.find((admin) => admin.id === targetId);
    if (
      !canEditAcessos ||
      !user?.id ||
      targetId === user.id ||
      targetAdmin?.can_remove !== true
    ) {
      return;
    }

    const attempts =
      removalAttemptsRef.current ?? loadRemovalAttempts();
    removalAttemptsRef.current = attempts;
    let attempt = attempts.get(targetId);
    if (!attempt || attempt.actorUserId !== user.id) {
      attempt = {
        actorUserId: user.id,
        targetUserId: targetId,
        requestId: crypto.randomUUID(),
        removalConfirmed: false,
      };
      attempts.set(targetId, attempt);
      if (!persistRemovalAttempts(attempts)) {
        attempts.delete(targetId);
        toast.error(
          "Não foi possível preparar uma tentativa segura de remoção. Tente novamente.",
        );
        return;
      }
    }

    setExcludingUserId(targetId);
    try {
      setAdminListLoading(true);
      const currentAdmins = await fetchAdminListForRemoval();
      const currentTarget = currentAdmins.find(
        (admin) => admin.id === targetId,
      );

      if (!currentTarget) {
        attempts.delete(targetId);
        persistRemovalAttempts(attempts);
        toast.success("Usuário removido do painel administrativo.");
        setSelectedUserId(null);
        return;
      }

      if (currentTarget.can_remove !== true) {
        throw new Error(getRemovalBlockedMessage(currentTarget));
      }

      if (attempt.removalConfirmed) {
        attempt = {
          actorUserId: user.id,
          targetUserId: targetId,
          requestId: crypto.randomUUID(),
          removalConfirmed: false,
        };
        attempts.set(targetId, attempt);
        if (!persistRemovalAttempts(attempts)) {
          attempts.delete(targetId);
          throw new Error(
            "Não foi possível preparar uma nova tentativa segura de remoção.",
          );
        }
      }

      const { data, error } = await supabase.functions.invoke("remove-admin", {
        body: {
          target_user_id: targetId,
          request_id: attempt.requestId,
        },
      });

      if (error) {
        throw new Error(await getRemoveAdminErrorMessage(error));
      }

      const result = data as Partial<RemoveAdminSuccess> | null;
      const isExpectedResult =
        (result?.status === "removed" || result?.status === "already_removed") &&
        result.request_id === attempt.requestId &&
        result.target_user_id === targetId;

      if (!isExpectedResult) {
        throw new Error("A remoção não retornou uma confirmação válida. Tente novamente.");
      }

      attempt.removalConfirmed = true;
      persistRemovalAttempts(attempts);

      setAdminListLoading(true);
      const refreshedAdmins = await fetchAdminListForRemoval();
      if (refreshedAdmins.some((admin) => admin.id === targetId)) {
        const nextAttempt: RemovalAttempt = {
          actorUserId: user.id,
          targetUserId: targetId,
          requestId: crypto.randomUUID(),
          removalConfirmed: false,
        };
        attempts.set(targetId, nextAttempt);
        if (!persistRemovalAttempts(attempts)) {
          attempts.delete(targetId);
        }
        throw new Error(
          "O administrador continua ativo. Tente novamente para iniciar uma nova remoção segura.",
        );
      }

      attempts.delete(targetId);
      persistRemovalAttempts(attempts);
      toast.success("Usuário removido do painel administrativo.");
      setSelectedUserId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setAdminListLoading(false);
      setExcludingUserId(null);
    }
  };

  useEffect(() => {
    const name =
      profile?.full_name ||
      (user?.user_metadata?.full_name as string) ||
      (user?.user_metadata?.name as string) ||
      user?.email?.split("@")[0] ||
      "";
    const role =
      (user?.user_metadata?.cargo as string) ||
      (user?.user_metadata?.role as string) ||
      "";
    setFormFullName(name);
    setFormCargo(role);
  }, [profile?.full_name, user?.user_metadata?.full_name, user?.user_metadata?.name, user?.user_metadata?.cargo, user?.user_metadata?.role, user?.email]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [loading, user, navigate]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const updates: { full_name?: string; cargo?: string } = {};
      if (formFullName.trim()) updates.full_name = formFullName.trim();
      if (formCargo.trim()) updates.cargo = formCargo.trim();

      await supabase.auth.updateUser({
        data: {
          full_name: updates.full_name ?? formFullName.trim(),
          cargo: updates.cargo ?? formCargo.trim(),
        },
      });

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formFullName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;
      await refreshProfile();
      toast.success("Dados atualizados com sucesso!");
      setIsEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar dados.";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar senha.";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${user.id}.${ext}`;
    setAvatarUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("sistema")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("sistema").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) throw updateError;
      await refreshProfile();
      toast.success("Foto atualizada com sucesso!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar foto.";
      toast.error(message);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 pt-24">
        {activeTab === "dados-basicos" && (
          <div className="flex justify-end mb-6">
            <Button 
              variant="ghost" 
              className="bg-[hsl(0,0%,10%)] text-primary hover:bg-primary hover:text-black transition-colors"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Pencil className="w-4 h-4" />
              {isEditing ? "Cancelar" : "Editar conta"}
            </Button>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {activeTab === "sobre" && (
            <div className="mb-6">
              <Button 
                variant="ghost" 
                className="gap-2 bg-[#171717] text-primary hover:bg-primary hover:text-black transition-colors"
                onClick={() => setActiveTab("dados-basicos")}
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
          )}

          {activeTab === "acessos" && (
            <div className="mb-6 flex items-center justify-between">
              <Button 
                variant="ghost" 
                className="gap-2 bg-[#171717] text-primary hover:bg-primary hover:text-black transition-colors"
                onClick={() => setActiveTab("dados-basicos")}
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
              {canEditAcessos && (
                <Button 
                  variant="outline" 
                  className="gap-2 border-primary text-primary hover:bg-primary hover:text-black transition-colors"
                  onClick={() => setIsAddUserSheetOpen(true)}
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar usuário
                </Button>
              )}
            </div>
          )}
          
          <TabsList className={`w-full border-b border-border rounded-none bg-transparent p-0 h-auto grid ${hasPermission("acessos.view") ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger 
              value="dados-basicos" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 text-center text-primary data-[state=active]:text-primary"
            >
              Dados básicos
            </TabsTrigger>
            {hasPermission("acessos.view") && (
              <TabsTrigger 
                value="acessos"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 text-center text-primary data-[state=active]:text-primary"
              >
                Acessos
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="sobre"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 text-center text-primary data-[state=active]:text-primary"
            >
              Sobre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados-basicos" className="mt-8">
            <div className="space-y-8">
              {/* Bloco de Dados Básicos */}
              <div className="bg-card border border-border rounded-lg p-8 space-y-6">
                <h2 className="text-xl font-semibold">Dados básicos</h2>
                
                <div className="flex items-start gap-6">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                        <button
                          type="button"
                          disabled={avatarUploading}
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute bottom-0 right-0 bg-primary rounded-full p-2 disabled:opacity-50"
                        >
                          {avatarUploading ? (
                            <Loader2 className="w-4 h-4 text-black animate-spin" />
                          ) : (
                            <Pencil className="w-4 h-4 text-black" />
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex-1 space-y-6">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-sm text-foreground mb-2 block">Nome Completo</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              value={formFullName}
                              onChange={(e) => setFormFullName(e.target.value)}
                              className="bg-input border-border pl-10"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-foreground mb-2 block">E-mail ou telefone</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                              <Input
                                value={user?.email ?? ""}
                                disabled
                                className="bg-input border-border pl-10"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm text-foreground mb-2 block">Cargo</Label>
                            <div className="relative">
                              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                              <Input
                                value={formCargo}
                                onChange={(e) => setFormCargo(e.target.value)}
                                placeholder="Ex: Gerente de RH"
                                className="bg-input border-border pl-10"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => setIsEditing(false)}
                            disabled={savingProfile}
                          >
                            Cancelar
                          </Button>
                          <Button
                            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                          >
                            {savingProfile ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              "Salvar alterações"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-lg font-semibold">{displayName}</h3>
                          {cargo ? (
                            <p className="text-sm text-muted-foreground">{cargo}</p>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label className="text-sm text-muted-foreground">E-mail</Label>
                            <p className="text-foreground">{user?.email ?? "—"}</p>
                          </div>

                          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label className="text-sm text-muted-foreground">Senha</Label>
                            <p className="text-foreground">••••••••</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="bg-card border border-border rounded-lg p-8 space-y-6">
                  <h2 className="text-xl font-semibold mb-6">Segurança da conta</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm text-muted-foreground mb-3 block">Senha atual</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Insira sua senha atual"
                          className="bg-input border-border pl-10 pr-10"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground mb-3 block">Nova senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Insira sua nova senha"
                          className="bg-input border-border pl-10 pr-10"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground mb-3 block">Confirme nova senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirme sua nova senha"
                          className="bg-input border-border pl-10 pr-10"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button
                      variant="outline"
                      className="gap-2 border-primary text-primary hover:bg-primary hover:text-black"
                      onClick={handleUpdatePassword}
                      disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Atualizando...
                        </>
                      ) : (
                        "Atualizar senha"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Bloco de Sobre */}
              {isEditing && (
                <div className="bg-card border border-border rounded-lg p-8">
                  <h2 className="text-xl font-semibold mb-4">Sobre</h2>
                  <p className="text-muted-foreground mb-6">
                    Consulte os documentos para saber mais sobre como usamos suas informações.
                  </p>
                  <div className="flex justify-end">
                    <Button 
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary hover:text-black"
                      onClick={() => setActiveTab("sobre")}
                    >
                      Ver Política de Privacidade
                    </Button>
                  </div>
                </div>
              )}

              {/* Botão Sair da Conta */}
              {!isEditing && (
                <div className="flex justify-end mt-6">
                  <Button 
                    variant="ghost" 
                    className="bg-[hsl(0,0%,10%)] text-muted-foreground hover:bg-[hsl(0,0%,12%)]"
                    onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                  >
                    Sair da conta
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="acessos" className="mt-8">
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold">Acessos</h2>
              
              <div className={selectedUserId ? "grid grid-cols-2 gap-6" : ""}>
                <div className="space-y-4">
                  {adminListLoading ? (
                    <div className="text-muted-foreground py-4">Carregando...</div>
                  ) : adminList.length === 0 ? (
                    <div className="text-muted-foreground py-4">Nenhum administrador cadastrado.</div>
                  ) : (
                    adminList.map((admin) => (
                      <button
                        key={admin.id}
                        onClick={() => setSelectedUserId(selectedUserId === admin.id ? null : admin.id)}
                        className={`w-full flex items-center justify-between bg-[#1C1C1C] hover:bg-[#252525] transition-colors rounded-lg px-6 py-4 text-left ${
                          selectedUserId === admin.id ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <span className="text-foreground">{admin.full_name || admin.email || admin.id.slice(0, 8)}</span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>

                {selectedUserId && (() => {
                  const admin = adminList.find((a) => a.id === selectedUserId);
                  const isSelf = selectedUserId === user?.id;
                  const canRemoveAdmin =
                    canEditAcessos && !isSelf && admin?.can_remove === true;
                  return (
                    <div className="bg-[#1C1C1C] rounded-lg p-6 space-y-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {(admin?.full_name || admin?.email || "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{admin?.full_name || "—"}</h3>
                          <p className="text-sm text-muted-foreground">{admin?.email ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getRemovalStatusLabel(admin, isSelf)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold">Permissões</h4>
                        <Accordion type="multiple" className="w-full" defaultValue={PERMISSION_GROUPS.map((_, i) => `group-${i}`)}>
                          {PERMISSION_GROUPS.map((group, gi) => (
                            <AccordionItem key={gi} value={`group-${gi}`} className="border-border">
                              <AccordionTrigger className="text-foreground hover:text-primary">
                                {group.title}
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 pt-2">
                                  {group.keys.map((key) => (
                                    <div key={key} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`perm-${selectedUserId}-${key}`}
                                        checked={selectedUserPerms.includes(key)}
                                        onCheckedChange={() => canEditAcessos && togglePerm(key)}
                                        disabled={!canEditAcessos}
                                      />
                                      <label htmlFor={`perm-${selectedUserId}-${key}`} className="text-sm text-muted-foreground cursor-pointer">
                                        {getPermissionLabel(key)}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>

                      {canEditAcessos && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleSavePermissions}
                            disabled={savingPerms || !selectedUserPermsLoaded || selectedUserPerms.length === 0}
                          >
                            {savingPerms ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Salvar permissões
                          </Button>
                        </div>
                      )}

                      {canEditAcessos && (
                        <div className="pt-4">
                          <Button
                            variant="ghost"
                            className="gap-2 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                            disabled={!!excludingUserId || !canRemoveAdmin}
                            onClick={() => handleExcluirAdmin(selectedUserId)}
                          >
                            {excludingUserId === selectedUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Remover administrador
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sobre" className="mt-8">
            {sobreLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-10">
                <div className="space-y-4">
                  <h1 className="text-2xl font-semibold">Termos de Uso</h1>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {termosUso || "Conteúdo não disponível no momento."}
                  </p>
                </div>

                <div className="space-y-4">
                  <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {politicaPrivacidade || "Conteúdo não disponível no momento."}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AddUserSheet
        open={isAddUserSheetOpen}
        onOpenChange={setIsAddUserSheetOpen}
        onSuccess={() => {
          setIsAddUserSheetOpen(false);
          if (activeTab === "acessos") {
            fetchAdminList().catch(() => {
              toast.error("Convite enviado, mas não foi possível atualizar a lista de administradores.");
            });
          }
        }}
      />
    </div>
  );
};

export default MinhaConta;
