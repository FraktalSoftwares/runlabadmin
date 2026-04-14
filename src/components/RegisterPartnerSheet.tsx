import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface RegisterPartnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RegisterPartnerSheet = ({ open, onOpenChange }: RegisterPartnerSheetProps) => {
  const [name, setName] = useState("");
  const [partnerType, setPartnerType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const partnerTypes = ["Assessoria", "Academia", "Treinador", "Individual", "Influenciador"];

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 0) return "";
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name || !partnerType || !email || !city || !state) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      // Buscar usuário pelo email na view de corredores
      const { data: users, error: userError } = await supabase
        .from("v_corredores_admin")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .limit(1);

      if (userError) throw userError;

      if (!users || users.length === 0) {
        toast.error("Nenhum usuário encontrado com este e-mail. O parceiro precisa ter uma conta no RunLab primeiro.");
        return;
      }

      const userId = users[0].id;

      // Verificar se já existe partnership_request para esse usuário
      const { data: existing } = await supabase
        .from("partnership_requests")
        .select("id, status")
        .eq("user_id", userId)
        .limit(1);

      if (existing && existing.length > 0) {
        const status = existing[0].status;
        if (status === "approved") {
          toast.error("Este usuário já é um parceiro ativo.");
        } else if (status === "pending") {
          toast.error("Este usuário já tem uma solicitação de parceria pendente.");
        } else {
          // Reativar parceiro inativo
          const { error: updateError } = await supabase
            .from("partnership_requests")
            .update({
              status: "approved",
              partner_type: partnerType,
              phone: phone || null,
              city,
              state,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);

          if (updateError) throw updateError;
          toast.success("Parceiro reativado com sucesso!");
        }
      } else {
        // Criar nova solicitação já aprovada
        const { error: insertError } = await supabase
          .from("partnership_requests")
          .insert({
            user_id: userId,
            partner_type: partnerType,
            email: email.trim().toLowerCase(),
            phone: phone || null,
            city,
            state,
            status: "approved",
          });

        if (insertError) throw insertError;

        // Atualizar perfil para marcar como parceiro
        await supabase
          .from("profiles")
          .update({ is_partner: true, tipo_user: "Parceiro" })
          .eq("id", userId);

        toast.success("Parceiro cadastrado com sucesso!");
      }

      onOpenChange(false);
      setName("");
      setPartnerType("");
      setEmail("");
      setPhone("");
      setCity("");
      setState("");
    } catch (e) {
      toast.error(`Erro ao cadastrar parceiro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[40vw] sm:max-w-none bg-[#262626] border-border p-0 overflow-hidden flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Cadastrar novo parceiro
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Preencha as informações abaixo para cadastrar um novo parceiro.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-6 overflow-y-auto flex-1">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-foreground">
              Nome
            </Label>
            <Input
              id="name"
              placeholder="Digite o nome completo do parceiro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
            />
          </div>

          {/* Tipo de parceiro */}
          <div className="space-y-3">
            <Label className="text-sm text-foreground">Tipo de parceiro</Label>
            <div className="flex flex-wrap gap-2">
              {partnerTypes.map((type) => (
                <Button
                  key={type}
                  variant={partnerType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPartnerType(partnerType === type ? "" : type)}
                  className={
                    partnerType === type
                      ? "bg-success text-success-foreground"
                      : "bg-[#1A1A1A] text-foreground border-0"
                  }
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          {/* E-mail */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
            />
          </div>

          {/* Telefone (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm text-foreground">
              Telefone (opcional)
            </Label>
            <Input
              id="phone"
              type="text"
              placeholder="(DDD) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={15}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
            />
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm text-foreground">
                Cidade
              </Label>
              <Input
                id="city"
                placeholder="Digite a cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="text-sm text-foreground">
                Estado
              </Label>
              <Input
                id="state"
                placeholder="Digite o estado"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground transition-all hover:border-primary"
              />
            </div>
          </div>
        </div>

        <SheetFooter className="p-6 pt-4 border-t border-border mt-auto">
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
            >
              {saving ? "Cadastrando..." : "Cadastrar parceiro"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
