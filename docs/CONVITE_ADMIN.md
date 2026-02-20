# Convite de administrador e definição de senha

Quando um admin convida um novo membro (AddUserSheet), o convidado recebe um e-mail com um link. **O link deve levar o usuário para a tela de definir senha**, e não deixá-lo já logado no sistema.

## URL de redirecionamento (redirect)

Após clicar no link do e-mail, o convidado deve ser redirecionado para:

```
https://<seu-dominio>/definir-senha
```

Exemplos:
- Desenvolvimento: `http://localhost:5173/definir-senha`
- Produção: `https://admin.runlab.com.br/definir-senha` (ou a URL base do admin)

## Onde configurar

### 1. Edge Function `invite-admin`

Na chamada ao Supabase Auth (ex.: `admin.auth.inviteUserByEmail` ou `generateLink`), envie a URL de redirect:

- **Parâmetro:** `redirect_to` (ou o que a API do Supabase usar para o link de convite)
- **Valor:** a URL completa da sua aplicação + `/definir-senha`

Exemplo em código (no backend/Edge Function):

```ts
const redirectTo = `${process.env.APP_URL_OU_SITE_URL}/definir-senha`;
// ao gerar o link de convite, passar redirectTo
```

O frontend exporta a mesma lógica em `getDefinirSenhaRedirectUrl()` em `src/pages/DefinarSenha.tsx` (usa `window.location.origin`); no servidor use a variável de ambiente da URL do app.

### 2. Supabase Dashboard

1. **Authentication** → **URL Configuration**
2. Em **Redirect URLs**, adicione a URL de definição de senha:
   - `http://localhost:5173/definir-senha` (dev)
   - `https://<seu-dominio>/definir-senha` (produção)

Sem isso, o Supabase pode bloquear o redirect após o clique no link do e-mail.

## Fluxo para o convidado

1. Recebe o e-mail e clica no link.
2. Supabase valida o token e redireciona para `/definir-senha`.
3. A página **DefinarSenha** exibe o formulário “Defina sua senha”.
4. O usuário informa senha + confirmação e clica em “Concluir cadastro”.
5. A senha é salva, o usuário é deslogado e redirecionado para o login.
6. Passa a acessar o sistema com e-mail + senha definida.

## Template de e-mail (Supabase)

Em **Authentication** → **Email Templates** → **Invite**, use o template em `docs/supabase-email-templates/invite.html`. O link do botão usa `{{ .ConfirmationURL }}`, que já inclui o redirect configurado na geração do convite (Edge Function).
