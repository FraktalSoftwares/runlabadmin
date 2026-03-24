# Templates de e-mail para Supabase

Use estes HTMLs no **Supabase Dashboard** → **Authentication** → **Email Templates**.

Para cada tipo de e-mail:
1. Abra o template no Dashboard (ex.: **Reset password**).
2. **Subject:** copie o assunto do comentário no topo do arquivo `.html`.
3. **Body (Message):** copie todo o conteúdo HTML do arquivo (incluindo as variáveis `{{ .ConfirmationURL }}`, etc.).

Variáveis disponíveis no Supabase:
- `{{ .ConfirmationURL }}` — URL completa de confirmação (use no link do botão).
- `{{ .SiteURL }}` — URL do site configurada no projeto.
- `{{ .RedirectTo }}` — URL de redirecionamento.
- `{{ .Email }}` — E-mail do usuário.
- `{{ .Token }}` — Código OTP de 6 dígitos (alternativa ao link).

**Importante:** não altere as variáveis `{{ ... }}`; o Supabase substitui elas ao enviar o e-mail.

Arquivos:
- **recovery.html** — Recuperação de senha (Reset password)
- **confirmation.html** — Confirmação de cadastro (Confirm signup)
- **magic_link.html** — Magic link (login sem senha)
- **invite.html** — Convite de usuário (Invite user)
- **email_change.html** — Confirmação de mudança de e-mail
- **reauthentication.html** — Código de verificação (Reauthentication)
