# RUNLAB - Documentação Completa: Sistema de Pagamentos e Créditos

> **Objetivo**: Este documento detalha toda a arquitetura do sistema de pagamentos e créditos implementado no RUNLAB, para ser consumido pelo **app mobile do corredor**. O app mobile é o lado do consumo: o corredor compra créditos e os utiliza para participar de corridas/desafios.

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Banco de Dados - Tabelas](#2-banco-de-dados---tabelas)
3. [Banco de Dados - Views](#3-banco-de-dados---views)
4. [Banco de Dados - Triggers](#4-banco-de-dados---triggers)
5. [Banco de Dados - Políticas RLS](#5-banco-de-dados---políticas-rls)
6. [Planos Disponíveis](#6-planos-disponíveis)
7. [Edge Functions (Backend Serverless)](#7-edge-functions-backend-serverless)
8. [Fluxo Completo de Compra](#8-fluxo-completo-de-compra)
9. [Fluxo de Consumo de Créditos (App Mobile)](#9-fluxo-de-consumo-de-créditos-app-mobile)
10. [Tipos e Interfaces TypeScript](#10-tipos-e-interfaces-typescript)
11. [Queries Supabase Prontas para o App](#11-queries-supabase-prontas-para-o-app)
12. [Gateway de Pagamento - Asaas](#12-gateway-de-pagamento---asaas)
13. [Tratamento de Erros e Status](#13-tratamento-de-erros-e-status)
14. [Variáveis de Ambiente](#14-variáveis-de-ambiente)
15. [Considerações para o App Mobile](#15-considerações-para-o-app-mobile)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   App Mobile    │────>│  Supabase Edge Func   │────>│   Asaas     │
│   (Corredor)    │<────│  (asaas-checkout)     │<────│  (Gateway)  │
└────────┬────────┘     └──────────┬───────────┘     └─────────────┘
         │                         │
         │    ┌────────────────────┘
         │    │
         v    v
┌─────────────────────────────────────────────┐
│              Supabase PostgreSQL             │
│  ┌─────────┐  ┌──────────────────┐          │
│  │  plans   │  │ runner_payments  │          │
│  └─────────┘  └────────┬─────────┘          │
│                         │ TRIGGER            │
│               ┌─────────v──────────┐         │
│               │credit_transactions │         │
│               └─────────┬──────────┘         │
│                         │ VIEW               │
│              ┌──────────v───────────┐        │
│              │user_credit_balances  │        │
│              └──────────────────────┘        │
└─────────────────────────────────────────────┘
```

**Fluxo resumido:**
1. Corredor escolhe um plano no app
2. App abre a tela de checkout (pode ser WebView ou nativa)
3. Pagamento é processado via Edge Function `asaas-checkout` -> Asaas API
4. Registro salvo na tabela `runner_payments`
5. **Trigger automático** `grant_credits_on_payment()` cria uma `credit_transaction` de tipo `purchase`
6. View `user_credit_balances` reflete o saldo atualizado automaticamente
7. Corredor consome créditos ao se inscrever em corridas/desafios

---

## 2. Banco de Dados - Tabelas

### 2.1 `plans` - Planos Disponíveis

Tabela de planos configuráveis pelo admin. Os planos definem preço, tipo e quantos créditos o corredor recebe.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `slug` | `text` | NOT NULL | — | Identificador legível único (ex: `challenge-ticket`, `runlab-club`) |
| `name` | `text` | NOT NULL | — | Nome de exibição (ex: "CHALLENGE TICKET") |
| `subtitle` | `text` | NULL | — | Subtítulo opcional |
| `description` | `text` | NULL | — | Descrição/texto de apoio |
| `type` | `text` | NOT NULL | — | `'avulsa'` (compra única) ou `'anual'` (assinatura) |
| `price` | `numeric` | NOT NULL | — | Preço total do plano em BRL |
| `installments_count` | `integer` | NULL | `1` | Número de parcelas (1 = à vista) |
| `installment_value` | `numeric` | NULL | — | Valor de cada parcela (null se à vista) |
| `credits_amount` | `integer` | NOT NULL | `1` | **Quantidade de créditos concedidos ao comprar** |
| `features` | `text[]` | NOT NULL | `'{}'` | Array de benefícios para exibição no card |
| `highlight` | `boolean` | NOT NULL | `false` | Se true, card é destacado visualmente |
| `is_active` | `boolean` | NOT NULL | `true` | Somente planos ativos são exibidos |
| `sort_order` | `integer` | NOT NULL | `0` | Ordem de exibição (menor = primeiro) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | — |

**CHECK constraints:**
- `type IN ('avulsa', 'anual')`

---

### 2.2 `runner_payments` - Pagamentos dos Corredores

Cada pagamento feito por um corredor é registrado aqui. Contém os dados do gateway Asaas.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users.id` |
| `plan_id` | `uuid` | NULL | — | FK → `plans.id` (plano comprado) |
| `plan_type` | `text` | NOT NULL | — | `'avulsa'` ou `'anual'` |
| `billing_type` | `text` | NOT NULL | — | Forma de pagamento |
| `amount` | `numeric` | NOT NULL | — | Valor total em BRL |
| `status` | `text` | NOT NULL | `'PENDING'` | Status do pagamento |
| `asaas_customer_id` | `text` | NULL | — | ID do cliente no Asaas |
| `asaas_payment_id` | `text` | NULL | — | ID do pagamento no Asaas |
| `asaas_subscription_id` | `text` | NULL | — | ID da assinatura no Asaas (para plano anual) |
| `asaas_invoice_url` | `text` | NULL | — | URL da fatura |
| `asaas_bank_slip_url` | `text` | NULL | — | URL do boleto PDF |
| `asaas_pix_qrcode` | `text` | NULL | — | QR Code PIX (base64 image) |
| `asaas_pix_payload` | `text` | NULL | — | Código copia-e-cola PIX |
| `asaas_pix_expiration_date` | `timestamptz` | NULL | — | Expiração do PIX |
| `installment_count` | `integer` | NULL | `1` | Número de parcelas selecionado |
| `description` | `text` | NULL | — | Descrição do pagamento |
| `external_reference` | `text` | NULL | — | Referência externa (`runlab_{userId}_{timestamp}`) |
| `paid_at` | `timestamptz` | NULL | — | Data/hora de confirmação |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | — |

**CHECK constraints:**
- `billing_type IN ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO')`
- `status IN ('PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'FAILED', 'CANCELLED')`

**Status possíveis:**

| Status | Significado |
|--------|-------------|
| `PENDING` | Aguardando pagamento (PIX, boleto) ou análise (cartão) |
| `CONFIRMED` | Pagamento confirmado - **créditos já foram concedidos** |
| `RECEIVED` | Recebido (mapeado para CONFIRMED internamente) |
| `OVERDUE` | Vencido (boleto não pago) |
| `REFUNDED` | Reembolsado |
| `FAILED` | Falhou (cartão recusado, etc.) |
| `CANCELLED` | Cancelado |

---

### 2.3 `credit_transactions` - Movimentações de Créditos

Cada adição ou subtração de créditos é registrada como uma transação. É o "extrato" do corredor.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users.id` |
| `amount` | `integer` | NOT NULL | — | **Positivo = crédito adicionado, Negativo = crédito consumido** |
| `type` | `text` | NOT NULL | — | Tipo da transação |
| `description` | `text` | NULL | — | Descrição legível |
| `payment_id` | `uuid` | NULL | — | FK → `runner_payments.id` (quando tipo = purchase) |
| `competition_registration_id` | `uuid` | NULL | — | FK → `competition_registrations.id` (quando tipo = usage) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |

**CHECK constraints:**
- `type IN ('purchase', 'usage', 'refund', 'expiration', 'admin_adjustment')`

**Tipos de transação:**

| Tipo | Direção | Descrição | Quando ocorre |
|------|---------|-----------|---------------|
| `purchase` | `+` (positivo) | Compra de créditos | Pagamento confirmado (trigger automático) |
| `usage` | `-` (negativo) | Uso em corrida/desafio | **Corredor se inscreve em competição no app** |
| `refund` | `+` (positivo) | Reembolso | Admin processa reembolso |
| `expiration` | `-` (negativo) | Expiração | Créditos expirados (se aplicável) |
| `admin_adjustment` | `+/-` | Ajuste manual | Admin ajusta saldo |

**Exemplos de `amount`:**
- `+1` → Compra avulsa (CHALLENGE TICKET)
- `+12` → Compra do plano anual (RUNLAB CLUB)
- `-1` → Corredor se inscreveu em uma corrida
- `+1` → Reembolso de uma corrida cancelada

---

## 3. Banco de Dados - Views

### 3.1 `user_credit_balances` - Saldo de Créditos

View calculada automaticamente a partir da tabela `credit_transactions`. **Não é uma tabela — sempre reflete o saldo real.**

```sql
SELECT
  user_id,
  COALESCE(SUM(amount), 0)::integer AS balance,
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::integer AS total_earned,
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::integer AS total_spent
FROM credit_transactions
GROUP BY user_id;
```

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `user_id` | `uuid` | ID do usuário |
| `balance` | `integer` | **Saldo atual de créditos** (pode ser 0, nunca negativo na prática) |
| `total_earned` | `integer` | Total de créditos já recebidos (soma dos positivos) |
| `total_spent` | `integer` | Total de créditos já gastos (soma dos valores absolutos dos negativos) |

**Uso no app:** Consultar `balance` para saber quantos créditos o corredor tem disponíveis.

---

### 3.2 `v_corredores_admin` - Dados do Corredor (inclui saldo)

View que unifica profiles + auth.users + credit_balances.

```sql
SELECT
  p.id, p.full_name, u.email, p.birth_date, p.gender,
  p.preferred_distance, p.running_experience, p.avatar_url,
  p.tipo_user, p.created_at, p.updated_at,
  COALESCE(cb.balance, 0) AS credit_balance
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN user_credit_balances cb ON cb.user_id = p.id
WHERE p.tipo_user IN ('Corredor', 'Parceiro');
```

---

## 4. Banco de Dados - Triggers

### 4.1 `grant_credits_on_payment` - Concessão Automática de Créditos

Trigger que executa automaticamente quando um `runner_payment` é inserido ou atualizado com `status = 'CONFIRMED'`.

**Eventos:** `AFTER INSERT` e `AFTER UPDATE` na tabela `runner_payments`

**Lógica:**
1. Verifica se o status mudou para `'CONFIRMED'`
2. Verifica idempotência (se já existe `credit_transaction` com tipo `purchase` para esse `payment_id`)
3. Busca `credits_amount` do plano (`plan_id` ou fallback por `plan_type`)
4. Insere uma `credit_transaction` do tipo `purchase`

```sql
CREATE OR REPLACE FUNCTION public.grant_credits_on_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_credits_amount INT;
  v_plan_name TEXT;
  v_already_granted BOOLEAN;
BEGIN
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status <> 'CONFIRMED') THEN

    -- Idempotência: não concede créditos duplicados
    SELECT EXISTS(
      SELECT 1 FROM credit_transactions
      WHERE payment_id = NEW.id AND type = 'purchase'
    ) INTO v_already_granted;

    IF v_already_granted THEN
      RETURN NEW;
    END IF;

    -- Busca créditos do plano
    IF NEW.plan_id IS NOT NULL THEN
      SELECT credits_amount, name INTO v_credits_amount, v_plan_name
      FROM plans WHERE id = NEW.plan_id;
    ELSE
      SELECT credits_amount, name INTO v_credits_amount, v_plan_name
      FROM plans WHERE type = NEW.plan_type LIMIT 1;
    END IF;

    IF v_credits_amount IS NULL THEN
      v_credits_amount := 1;
      v_plan_name := COALESCE(NEW.description, 'Plano');
    END IF;

    -- Insere transação de crédito
    INSERT INTO credit_transactions (user_id, amount, type, description, payment_id)
    VALUES (
      NEW.user_id,
      v_credits_amount,
      'purchase',
      'Compra: ' || v_plan_name || ' (+' || v_credits_amount || ' crédito' ||
        CASE WHEN v_credits_amount > 1 THEN 's' ELSE '' END || ')',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
```

**Importante:** O app mobile NÃO precisa inserir créditos manualmente. Basta que o pagamento seja confirmado e o trigger faz o resto.

---

## 5. Banco de Dados - Políticas RLS

### 5.1 Tabela `plans`

| Política | Comando | Quem | Condição |
|----------|---------|------|----------|
| Anyone can view active plans | `SELECT` | Qualquer autenticado | `is_active = true` |
| Admins can manage plans | `ALL` | Admins | `profiles.tipo_user = 'Administrador'` |
| Service role can manage plans | `ALL` | Service role | `auth.role() = 'service_role'` |

**App mobile:** Pode fazer `SELECT` normalmente em `plans` onde `is_active = true`.

### 5.2 Tabela `runner_payments`

| Política | Comando | Quem | Condição |
|----------|---------|------|----------|
| Users can view own payments | `SELECT` | Autenticado | `auth.uid() = user_id` |
| Service role can manage payments | `ALL` | Service role | `auth.role() = 'service_role'` |

**App mobile:** Corredor consegue listar seus próprios pagamentos. **Inserções são feitas pela Edge Function** (service_role).

### 5.3 Tabela `credit_transactions`

| Política | Comando | Quem | Condição |
|----------|---------|------|----------|
| Users can view own credit transactions | `SELECT` | Autenticado | `auth.uid() = user_id` |
| Admins can view all credit transactions | `SELECT` | Admins | `profiles.tipo_user = 'Administrador'` |

**App mobile:** Corredor consegue listar seu extrato de créditos. **Inserções devem ser feitas via Edge Function ou pelo backend** (service_role), não diretamente pelo app.

---

## 6. Planos Disponíveis

### 6.1 CHALLENGE TICKET (Avulsa)

| Campo | Valor |
|-------|-------|
| **slug** | `challenge-ticket` |
| **type** | `avulsa` |
| **price** | R$ 59,90 |
| **installments** | 1 (pagamento único) |
| **credits_amount** | **1 crédito** |
| **features** | Participação em 1 desafio, Ranking nacional, Medalha virtual, Acesso à comunidade |
| **highlight** | `false` |

### 6.2 RUNLAB CLUB (Anual)

| Campo | Valor |
|-------|-------|
| **slug** | `runlab-club` |
| **type** | `anual` |
| **price** | R$ 610,00 |
| **installments** | 12x de R$ 50,84 |
| **credits_amount** | **12 créditos** |
| **features** | 12 desafios/ano, Ranking ativo o ano inteiro, Sorteios exclusivos, Acesso antecipado |
| **highlight** | `true` (destacado na UI) |

### 6.3 Lógica de Plano do Corredor

Com base nos créditos, o "plano" exibido para o corredor é derivado:

| Condição | Plano Exibido |
|----------|---------------|
| Nenhum pagamento confirmado | **Gratuito** |
| Tem pagamento `anual` confirmado | **Plus** |
| Tem pagamento `avulsa` confirmado (sem anual) | **Essencial** |

---

## 7. Edge Functions (Backend Serverless)

### 7.1 `asaas-checkout` — Processar Pagamento

**URL:** `{SUPABASE_URL}/functions/v1/asaas-checkout`
**Método:** `POST`
**Auth:** Bearer token JWT do usuário (header `Authorization`)
**JWT verify:** `false` (a função valida manualmente)

#### Request Body

```typescript
{
  planId: string;                     // UUID do plano escolhido
  billingType: "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "BOLETO";
  installmentCount?: number;          // Número de parcelas (default: 1)
  customer: {                         // Dados do cliente
    name: string;
    cpfCnpj: string;                  // Somente números ou formatado
    email: string;
    phone?: string;
  };
  creditCard?: {                      // Obrigatório para CREDIT_CARD/DEBIT_CARD
    holderName: string;
    number: string;                   // Sem espaços
    expiryMonth: string;              // "06"
    expiryYear: string;               // "2028"
    ccv: string;
  };
  creditCardHolderInfo?: {            // Obrigatório para CREDIT_CARD/DEBIT_CARD
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;               // CEP somente números
    addressNumber: string;
    addressComplement?: string;
    phone: string;                    // Somente números
  };
}
```

#### Response — Cartão de Crédito/Débito (sucesso)

```json
{
  "success": true,
  "paymentId": "pay_xxx",
  "status": "CONFIRMED",
  "invoiceUrl": "https://...",
  "plan": "avulsa",
  "planName": "CHALLENGE TICKET",
  "amount": 59.90,
  "billingType": "CREDIT_CARD",
  "creditsAmount": 1,
  "card": {
    "status": "CONFIRMED",
    "confirmedDate": "2026-02-17"
  }
}
```

#### Response — PIX

```json
{
  "success": true,
  "paymentId": "pay_xxx",
  "status": "PENDING",
  "plan": "avulsa",
  "planName": "CHALLENGE TICKET",
  "amount": 59.90,
  "billingType": "PIX",
  "creditsAmount": 1,
  "pix": {
    "qrCodeImage": "iVBORw0KGgo...",
    "payload": "00020126580014br.gov.bcb.pix...",
    "expirationDate": "2026-02-18T23:59:59Z"
  }
}
```

- `qrCodeImage`: String base64 da imagem PNG do QR Code
- `payload`: String do código Pix copia-e-cola
- Após gerar o PIX, deve-se iniciar **polling** na função `asaas-payment-status`

#### Response — Boleto

```json
{
  "success": true,
  "paymentId": "pay_xxx",
  "status": "PENDING",
  "plan": "avulsa",
  "planName": "CHALLENGE TICKET",
  "amount": 59.90,
  "billingType": "BOLETO",
  "creditsAmount": 1,
  "boleto": {
    "bankSlipUrl": "https://...",
    "dueDate": "2026-02-20",
    "nossoNumero": "123456",
    "invoiceUrl": "https://..."
  }
}
```

- `bankSlipUrl`: URL para download do boleto PDF
- `invoiceUrl`: URL para visualização online
- Após gerar o boleto, deve-se iniciar **polling** na função `asaas-payment-status`

#### Response — Erro

```json
{
  "error": "Mensagem descritiva do erro"
}
```

Status HTTP: 400 (validação), 401 (auth), 403 (acesso), 404 (plano), 500 (interno)

---

### 7.2 `asaas-payment-status` — Verificar Status do Pagamento

**URL:** `{SUPABASE_URL}/functions/v1/asaas-payment-status`
**Método:** `POST`
**Auth:** Bearer token JWT do usuário

#### Request Body

```typescript
{
  paymentId: string;  // ID do pagamento no Asaas (ex: "pay_xxx")
}
```

#### Response

```json
{
  "paymentId": "pay_xxx",
  "status": "CONFIRMED",
  "localStatus": "CONFIRMED",
  "value": 59.90,
  "billingType": "PIX",
  "invoiceUrl": "https://...",
  "bankSlipUrl": null,
  "dueDate": "2026-02-20",
  "paymentDate": "2026-02-17",
  "plan": "avulsa",
  "confirmed": true
}
```

**Campo chave:** `confirmed` (boolean) — indica se o pagamento foi confirmado.

**Lógica do polling:**
1. Chamar a cada 5 segundos
2. Se `confirmed === true` → pagamento concluído, navegar para tela de sucesso
3. Se `confirmed === false` após 60 tentativas (5 min) → exibir mensagem de "pagamento pendente"

**O que essa função faz internamente:**
1. Verifica que o `paymentId` pertence ao usuário autenticado
2. Consulta o status atual na API do Asaas
3. Se o status mudou, atualiza a tabela `runner_payments` no banco
4. A atualização do `runner_payments` para CONFIRMED **dispara o trigger de créditos automaticamente**

---

## 8. Fluxo Completo de Compra

### 8.1 Fluxo com Cartão de Crédito

```
1. [App] GET plans (is_active = true) → Listar planos
2. [App] Corredor seleciona plano
3. [App] Corredor preenche dados do cartão + CPF + telefone
4. [App] POST asaas-checkout {planId, billingType: "CREDIT_CARD", creditCard, ...}
5. [Edge Fn] Cria/encontra customer no Asaas
6. [Edge Fn] Cria payment (ou subscription se anual) no Asaas
7. [Edge Fn] Processa pagamento com cartão (payWithCreditCard)
8. [Edge Fn] Salva em runner_payments (status CONFIRMED ou PENDING)
9. [Trigger] Se CONFIRMED → insere credit_transaction type=purchase
10. [Edge Fn] Retorna {status: "CONFIRMED", creditsAmount: N}
11. [App] Navega para tela de sucesso com detalhes
```

### 8.2 Fluxo com Cartão de Débito

Idêntico ao crédito, porém:
- `billingType: "DEBIT_CARD"`
- Necessita informar **endereço de cobrança** (postalCode, addressNumber)
- Sem opção de parcelamento

### 8.3 Fluxo com PIX

```
1. [App] POST asaas-checkout {planId, billingType: "PIX", customer}
2. [Edge Fn] Cria payment no Asaas
3. [Edge Fn] Gera QR Code PIX
4. [Edge Fn] Salva em runner_payments (status PENDING)
5. [Edge Fn] Retorna {pix: {qrCodeImage, payload, expirationDate}}
6. [App] Exibe QR Code e código copia-e-cola
7. [App] Inicia polling: POST asaas-payment-status {paymentId} a cada 5s
8. [Corredor] Paga via app do banco
9. [Asaas] Confirma pagamento
10. [Edge Fn status] Detecta CONFIRMED, atualiza runner_payments
11. [Trigger] Insere credit_transaction type=purchase
12. [App] Polling detecta confirmed=true → navega para tela de sucesso
```

### 8.4 Fluxo com Boleto

```
1. [App] POST asaas-checkout {planId, billingType: "BOLETO", customer}
2. [Edge Fn] Cria payment no Asaas
3. [Edge Fn] Salva em runner_payments (status PENDING)
4. [Edge Fn] Retorna {boleto: {bankSlipUrl, dueDate, nossoNumero, invoiceUrl}}
5. [App] Exibe informações do boleto (data vencimento, link download)
6. [App] Inicia polling (intervalos maiores: 30s-60s, boleto demora mais)
7. [Corredor] Paga o boleto no banco
8. [Asaas] Confirma pagamento (pode levar 1-3 dias úteis)
9. [Edge Fn status] Detecta CONFIRMED, atualiza runner_payments
10. [Trigger] Insere credit_transaction type=purchase
11. [App] Polling ou notificação push informa confirmação
```

---

## 9. Fluxo de Consumo de Créditos (App Mobile)

Este é o fluxo que o app mobile do corredor precisa implementar para **gastar créditos**.

### 9.1 Verificar Saldo Antes de Inscrever

```typescript
// Consultar saldo do corredor
const { data } = await supabase
  .from('user_credit_balances')
  .select('balance, total_earned, total_spent')
  .eq('user_id', userId)
  .maybeSingle();

const saldo = data?.balance ?? 0;

if (saldo < 1) {
  // Direcionar para compra de créditos
}
```

### 9.2 Consumir Crédito ao Inscrever em Competição

**IMPORTANTE:** A inserção na `credit_transactions` com tipo `usage` deve ser feita de forma segura — preferencialmente via **Edge Function** ou **RPC (stored procedure)** para garantir atomicidade.

**Sugestão de implementação (RPC no banco):**

```sql
CREATE OR REPLACE FUNCTION consume_credit_for_registration(
  p_user_id UUID,
  p_competition_registration_id UUID,
  p_description TEXT DEFAULT 'Inscrição em desafio'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance INT;
BEGIN
  -- Verificar saldo atual
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_transactions
  WHERE user_id = p_user_id;

  IF v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente (saldo: %)', v_balance;
  END IF;

  -- Inserir transação de consumo
  INSERT INTO credit_transactions (
    user_id, amount, type, description, competition_registration_id
  ) VALUES (
    p_user_id,
    -1,
    'usage',
    p_description,
    p_competition_registration_id
  );

  RETURN TRUE;
END;
$$;
```

**Chamada no app:**

```typescript
const { data, error } = await supabase.rpc('consume_credit_for_registration', {
  p_user_id: userId,
  p_competition_registration_id: registrationId,
  p_description: 'Inscrição: Nome da Competição'
});
```

### 9.3 Fluxo Completo de Inscrição com Crédito

```
1. [App] Corredor clica "Participar" na competição
2. [App] Verifica se competição é gratuita (competition.is_free)
3. Se NÃO é gratuita:
   a. Consulta saldo em user_credit_balances
   b. Se saldo >= 1: prossegue para inscrição
   c. Se saldo < 1: mostra modal "Compre créditos" → tela de planos
4. [App] Cria registration em competition_registrations
5. [App/Backend] Chama consume_credit_for_registration
6. [Banco] Debita 1 crédito
7. [App] Confirma inscrição com sucesso
```

### 9.4 Reembolso de Crédito (Cancelamento)

Quando um corredor cancela inscrição, o crédito pode ser devolvido:

```sql
INSERT INTO credit_transactions (user_id, amount, type, description, competition_registration_id)
VALUES (
  p_user_id,
  1,          -- positivo = devolver
  'refund',
  'Reembolso: cancelamento de inscrição',
  p_competition_registration_id
);
```

---

## 10. Tipos e Interfaces TypeScript

### 10.1 Plan (Plano)

```typescript
interface Plan {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  type: 'avulsa' | 'anual';
  price: number;
  installments_count: number;
  installment_value: number | null;
  features: string[];
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
  credits_amount: number;
}
```

### 10.2 CreditTransaction (Transação de Crédito)

```typescript
interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;           // positivo = ganho, negativo = gasto
  type: 'purchase' | 'usage' | 'refund' | 'expiration' | 'admin_adjustment';
  description: string | null;
  payment_id: string | null;
  competition_registration_id: string | null;
  created_at: string;       // ISO 8601
}
```

### 10.3 CreditBalance (Saldo)

```typescript
interface CreditBalance {
  balance: number;          // saldo disponível
  total_earned: number;     // total já recebido
  total_spent: number;      // total já gasto
}
```

### 10.4 RunnerPayment (Pagamento)

```typescript
interface RunnerPayment {
  id: string;
  user_id: string;
  plan_id: string | null;
  plan_type: 'avulsa' | 'anual';
  billing_type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO';
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED' | 'FAILED' | 'CANCELLED';
  asaas_payment_id: string | null;
  installment_count: number | null;
  description: string | null;
  paid_at: string | null;   // ISO 8601
  created_at: string;
  updated_at: string;
}
```

### 10.5 Labels para Exibição

```typescript
// Tipo de transação → Label PT-BR
const TRANSACTION_TYPE_LABELS = {
  purchase: 'Compra',
  usage: 'Uso em desafio',
  refund: 'Reembolso',
  expiration: 'Expiração',
  admin_adjustment: 'Ajuste administrativo',
};

// Billing type → Label PT-BR
const BILLING_TYPE_LABELS = {
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
};

// Status → Label PT-BR
const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  RECEIVED: 'Recebido',
  OVERDUE: 'Vencido',
  REFUNDED: 'Reembolsado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

// Formato de preço
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
```

---

## 11. Queries Supabase Prontas para o App

### 11.1 Listar Planos Ativos

```typescript
const { data: plans } = await supabase
  .from('plans')
  .select('*')
  .eq('is_active', true)
  .order('sort_order', { ascending: true });
```

### 11.2 Consultar Saldo de Créditos

```typescript
const { data: balance } = await supabase
  .from('user_credit_balances')
  .select('balance, total_earned, total_spent')
  .eq('user_id', userId)
  .maybeSingle();

// Se null, corredor nunca teve transação → saldo = 0
const saldo = balance?.balance ?? 0;
```

### 11.3 Listar Extrato de Créditos

```typescript
const { data: transactions } = await supabase
  .from('credit_transactions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### 11.4 Listar Pagamentos do Corredor

```typescript
const { data: payments } = await supabase
  .from('runner_payments')
  .select('id, plan_type, description, billing_type, amount, status, installment_count, paid_at, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### 11.5 Verificar se Corredor Tem Créditos Suficientes

```typescript
async function hasEnoughCredits(userId: string, required: number = 1): Promise<boolean> {
  const { data } = await supabase
    .from('user_credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.balance ?? 0) >= required;
}
```

### 11.6 Processar Checkout (Chamar Edge Function)

```typescript
const { data, error } = await supabase.functions.invoke('asaas-checkout', {
  body: {
    planId: selectedPlan.id,
    billingType: 'PIX',  // ou 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO'
    customer: {
      name: user.fullName,
      cpfCnpj: '12345678900',
      email: user.email,
      phone: '11999999999',
    },
    // Se cartão, adicionar: creditCard, creditCardHolderInfo
  },
});
```

### 11.7 Polling de Status do Pagamento

```typescript
async function pollPaymentStatus(
  paymentId: string,
  onConfirmed: () => void,
  onTimeout: () => void,
  intervalMs: number = 5000,
  maxAttempts: number = 60
) {
  let attempts = 0;

  const poll = async () => {
    const { data, error } = await supabase.functions.invoke('asaas-payment-status', {
      body: { paymentId },
    });

    if (data?.confirmed) {
      onConfirmed();
      return;
    }

    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(poll, intervalMs);
    } else {
      onTimeout();
    }
  };

  poll();
}
```

---

## 12. Gateway de Pagamento - Asaas

### 12.1 Visão Geral

- **Gateway:** [Asaas](https://www.asaas.com/)
- **Ambiente Sandbox:** `https://api-sandbox.asaas.com/v3`
- **Ambiente Produção:** `https://api.asaas.com/v3`
- **Autenticação:** Header `access_token` com chave API

### 12.2 Fluxo Asaas Interno (Edge Function faz isso)

1. **Criar/buscar customer** (`POST /customers` ou `GET /customers?cpfCnpj=xxx`)
2. **Criar cobrança** (`POST /payments`) — para avulsa ou PIX/boleto
3. **Criar assinatura** (`POST /subscriptions`) — para plano anual + cartão
4. **Processar cartão** (`POST /payments/{id}/payWithCreditCard`) — para crédito/débito
5. **Gerar QR Code PIX** (`GET /payments/{id}/pixQrCode`) — para PIX
6. **Consultar status** (`GET /payments/{id}`) — para polling

### 12.3 Mapeamento de Status Asaas → Local

| Status Asaas | Status Local |
|-------------|-------------|
| `PENDING` | `PENDING` |
| `AWAITING_RISK_ANALYSIS` | `PENDING` |
| `CONFIRMED` | `CONFIRMED` |
| `RECEIVED` | `CONFIRMED` |
| `OVERDUE` | `OVERDUE` |
| `REFUNDED` | `REFUNDED` |
| `REFUND_REQUESTED` | `REFUNDED` |

---

## 13. Tratamento de Erros e Status

### 13.1 Erros Comuns do Checkout

| Erro | Causa | Ação no App |
|------|-------|-------------|
| "Não autorizado" (401) | Token JWT inválido/expirado | Redirecionar para login |
| "Acesso restrito a corredores" (403) | Usuário não é Corredor | Exibir mensagem |
| "Plano não encontrado ou inativo" (404) | Plano desativado | Recarregar lista de planos |
| "Preencha todos os campos do cartão" | Campos vazios | Validar formulário |
| Erro genérico do Asaas (500) | Cartão recusado, dados inválidos | Exibir mensagem de erro |

### 13.2 Tratamento no App

```typescript
try {
  const { data, error } = await supabase.functions.invoke('asaas-checkout', { body });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') {
    // Sucesso! Navegar para tela de confirmação
  } else if (data.pix) {
    // Exibir QR code e iniciar polling
  } else if (data.boleto) {
    // Exibir dados do boleto e iniciar polling
  } else if (data.status === 'PENDING') {
    // Pagamento em análise
  }
} catch (err) {
  // Exibir toast de erro
}
```

---

## 14. Variáveis de Ambiente

### 14.1 App Mobile (Cliente)

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 14.2 Edge Functions (Servidor - já configurado)

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...    # Chave admin - NUNCA expor no app
ASAAS_API_KEY=$aact_xxx...                 # Chave API do Asaas
ASAAS_ENV=sandbox                          # "sandbox" ou "production"
```

### 14.3 Retorno ao App após Pagamento Web (Opcional)

Se o checkout for via WebView, configurar URL de retorno:

```
VITE_APP_RETURN_URL=runlab://payment-callback
```

A tela de "Pagamento Confirmado" redireciona para essa URL com query params:

```
runlab://payment-callback?status=success&plan=avulsa&planName=CHALLENGE+TICKET&planType=Avulso&amount=59.90&paymentId=pay_xxx&paymentMethod=pix
```

---

## 15. Considerações para o App Mobile

### 15.1 Telas Necessárias

1. **Tela de Planos** — Lista planos ativos com preço, features, destaque
2. **Tela de Checkout** — Formulário com 4 métodos de pagamento
3. **Tela de QR Code PIX** — Exibe QR e código copia-e-cola, com polling
4. **Tela de Boleto** — Exibe dados + botão download/imprimir, com polling
5. **Tela de Confirmação** — Mostra detalhes + créditos adquiridos
6. **Tela de Saldo/Extrato** — Exibe saldo atual e histórico de transações
7. **Tela de Histórico de Pagamentos** — Lista todos os pagamentos

### 15.2 Checkout: WebView vs Nativo

**Opção A — WebView (mais rápido):**
- Reutiliza as páginas web já implementadas (`/corredor/planos`, `/corredor/checkout`)
- Configurar `VITE_APP_RETURN_URL` com deep link do app
- Interceptar deep link de retorno no app

**Opção B — Nativo (melhor UX):**
- Implementar formulários nativos usando as Edge Functions diretamente
- Mais controle sobre UX, validações e segurança
- Usar as queries e tipos documentados acima

### 15.3 Checklist de Implementação

- [ ] Configurar Supabase client no app mobile
- [ ] Implementar autenticação (login JWT)
- [ ] Tela de listagem de planos (`plans` table)
- [ ] Tela de checkout com 4 formas de pagamento
- [ ] Integração com Edge Function `asaas-checkout`
- [ ] Polling com Edge Function `asaas-payment-status`
- [ ] Tela de QR Code PIX (base64 → imagem)
- [ ] Tela de boleto (URL para download)
- [ ] Tela de confirmação de pagamento
- [ ] Exibição de saldo de créditos (`user_credit_balances`)
- [ ] Extrato de créditos (`credit_transactions`)
- [ ] Consumo de créditos ao inscrever em corrida (criar RPC ou Edge Function)
- [ ] Verificação de saldo antes de inscrição
- [ ] Tratamento de competições gratuitas (`competition.is_free`)
- [ ] Deep link de retorno (se usar WebView)
- [ ] Notificação push para pagamento confirmado (opcional)

### 15.4 Segurança

1. **NUNCA** armazenar `SUPABASE_SERVICE_ROLE_KEY` ou `ASAAS_API_KEY` no app mobile
2. Dados de cartão são enviados diretamente para a Edge Function (que repassa ao Asaas) — o app não persiste dados de cartão
3. Inserções em `runner_payments` e `credit_transactions` são feitas via Edge Functions (service_role), não pelo app
4. RLS garante que o corredor só vê seus próprios dados
5. O trigger de créditos é `SECURITY DEFINER` — executa com permissões elevadas

### 15.5 Consideração sobre Competições Gratuitas

A tabela `competitions` tem o campo `is_free` (boolean). Se `is_free = true`, o corredor pode se inscrever **sem gastar crédito**. Verificar este campo antes de tentar consumir crédito.

```typescript
const { data: competition } = await supabase
  .from('competitions')
  .select('is_free')
  .eq('id', competitionId)
  .single();

if (!competition.is_free) {
  // Verificar saldo e consumir crédito
}
```

---

## Diagrama de Entidade-Relacionamento (Simplificado)

```
auth.users
  │
  ├──> profiles (1:1)
  │
  ├──> runner_payments (1:N)
  │       │
  │       ├── plan_id ──> plans
  │       │
  │       └── TRIGGER ──> credit_transactions (purchase)
  │
  ├──> credit_transactions (1:N)
  │       │
  │       ├── payment_id ──> runner_payments
  │       └── competition_registration_id ──> competition_registrations
  │
  ├──> competition_registrations (1:N)
  │       │
  │       ├── competition_id ──> competitions
  │       ├── distance_id ──> competition_distances
  │       └── lot_id ──> competition_lots
  │
  └──> user_credit_balances (VIEW, calculada)
```

---

*Documento gerado em 18/02/2026 — Baseado no código fonte do runlabAdminWeb*
