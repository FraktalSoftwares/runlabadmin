import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSION_GROUPS, getPermissionLabel, type PermissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddUserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddUserSheet = ({ open, onOpenChange, onSuccess }: AddUserSheetProps) => {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const togglePerm = (key: PermissionKey) => {
    setPermissionKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("E-mail é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: {
          email: trimmedEmail,
          full_name: name.trim() || undefined,
          permission_keys: permissionKeys,
        },
        headers:
          session?.access_token != null
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
      });

      // Prefer error message from Edge Function body (e.g. "E-mail já convidado")
      const bodyError = (data as { error?: string; message?: string })?.error
        ?? (data as { error?: string; message?: string })?.message;
      if (bodyError) throw new Error(bodyError);

      if (error) {
        // supabase-js trata respostas não-2xx como FunctionsHttpError e zera `data`.
        // O corpo real (com a mensagem amigável) fica em error.context (Response clone).
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.clone === "function") {
          try {
            const body = await ctx.clone().json();
            const msg = body?.error ?? body?.message ?? body?.msg;
            if (msg) {
              const friendly = /already been registered|email_exists/i.test(String(msg))
                ? "E-mail já cadastrado no sistema."
                : String(msg);
              throw new Error(friendly);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message && parseErr.message !== "Failed to parse JSON") {
              throw parseErr;
            }
          }
        }
        throw error;
      }

      toast.success("Convite enviado! O usuário receberá um e-mail para definir a senha.");
      setName("");
      setEmail("");
      setPermissionKeys([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar convite.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[40vw] sm:max-w-none bg-[#262626] border-border p-0 overflow-hidden flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Adicionar novo membro
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Preencha as informações abaixo. Um e-mail de convite será enviado para o usuário definir a senha.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-6 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-foreground">
              Nome Completo
            </Label>
            <Input
              id="name"
              placeholder="Digite o nome e sobrenome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Insira e-mail do membro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
            />
          </div>

          <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={PERMISSION_GROUPS.map((_, i) => `ag-${i}`)}>
              {PERMISSION_GROUPS.map((group, gi) => (
                <AccordionItem key={gi} value={`ag-${gi}`} className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-primary">
                    {group.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {group.keys.map((key) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`add-${key}`}
                            checked={permissionKeys.includes(key)}
                            onCheckedChange={() => togglePerm(key)}
                          />
                          <label htmlFor={`add-${key}`} className="text-sm text-muted-foreground cursor-pointer">
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
        </div>

        <SheetFooter className="p-6 pt-4 border-t border-border mt-auto">
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 gap-2 bg-success text-success-foreground hover:bg-success/90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Concluir cadastro
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
