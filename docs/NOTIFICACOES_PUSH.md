# Notificações push (envio a todos os usuários)

## Fluxo

1. **Admin** (Corredores ou Parceiros) → "Enviar push" → preenche título, descrição e escolhe:
   - **Envio imediato**: entra na fila e é processado no próximo minuto.
   - **Envio agendado**: data/hora definidas; é processado quando o horário chegar.

2. **Fila** (`notification_queue`): cada registro criado pelo admin fica com `status = 'pending'`.

3. **Cron (pg_cron)**: a cada minuto roda `SELECT public.process_notification_queue();`:
   - Processa itens **imediato** (pendentes com `send_type = 'immediate'`).
   - Processa itens **agendado** cuja `scheduled_at <= now()`.
   - Para cada item: insere uma linha em `notifications` para **cada usuário com tipo_user = 'Corredor'** (em `profiles`) e marca o item como `sent`.

## Banco (Supabase)

- **Tabela** `notification_queue`: fila de notificações (title, description, send_type, scheduled_at, status).
- **Função** `process_notification_queue()`: processa todos os itens prontos e envia apenas para usuários com `tipo_user = 'Corredor'`.
- **Job cron** `process-notification-queue`: schedule `* * * * *` (todo minuto).

## Gerenciar o cron

No SQL Editor do Supabase (ou via MCP):

```sql
-- Ver job
SELECT jobid, jobname, schedule, command FROM cron.job;

-- Remover (se precisar)
SELECT cron.unschedule('process-notification-queue');

-- Recriar
SELECT cron.schedule('process-notification-queue', '* * * * *', 'SELECT public.process_notification_queue();');
```

## Teste rápido

1. No admin, crie uma notificação com "Envio imediato".
2. Em até 1 minuto, cada usuário com `tipo_user = 'Corredor'` em `profiles` deve receber uma linha em `notifications` com esse título/descrição.
3. Na `notification_queue`, o item deve estar com `status = 'sent'`.
