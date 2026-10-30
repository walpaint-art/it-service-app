# Deploy no Render

Aplicação preparada para rodar como **Web Service Node** no Render (plano **Free**), servindo o frontend compilado e a API na mesma URL.

## Como o deploy funciona

- O repositório é **público** e contém apenas código (nenhum dado de cliente).
- O banco com clientes/OS vai como **secret file** privado do Render (`/etc/secrets/database.seed.b64`, em base64).
- No primeiro boot, se o banco não existir, ele é criado a partir desse secret file.
- No plano **Free** não há disco persistente: banco e uploads voltam ao estado inicial (do secret file) a cada deploy ou restart.

## O que já está configurado no projeto

- `render.yaml` (Blueprint do Render) com plano Free e health check.
- `package.json` na raiz com `build` e `start`.
- `/api/health` para health check.
- `DB_PATH`, `UPLOADS_DIR` e `SEED_DB_B64_PATH` configuráveis por variável de ambiente.
- Script para redefinir senha: `server/scripts/set-password.js`.

## Segredos (nunca versionar)

Estes arquivos/pastas ficam fora do repositório (ver `.gitignore`):

- `server/database.sqlite` — banco com dados de clientes
- `server/imports/` — importações com dados de clientes
- `server/database.seed.b64` — versão base64 usada como secret file

Para gerar o secret file a partir do banco local:

```powershell
cd "C:\Users\Kadinfor\Documents\Projeto Padrão\it-service-app\server"
[Convert]::ToBase64String([IO.File]::ReadAllBytes("database.sqlite")) | Set-Content -NoNewline -Encoding ascii database.seed.b64
```

## Passo 1 — GitHub (repositório público)

```powershell
cd "C:\Users\Kadinfor\Documents\Projeto Padrão\it-service-app"
git push -u origin main
```

## Passo 2 — Criar o serviço no Render

### Opção A — Blueprint (recomendado)

1. Acesse https://dashboard.render.com
2. **New +** → **Blueprint** → conecte o repositório `it-service-app`
3. O Render lê o `render.yaml` e cria o serviço. Clique em **Apply**.

### Opção B — Manual

1. **New +** → **Web Service** → conecte o repositório
2. Preencha:
   - **Name:** `it-service-app`
   - **Region:** Virginia
   - **Branch:** `main`
   - **Runtime:** Node
   - **Plan:** Free
   - **Build Command:** `npm install --prefix server && npm install --include=dev --prefix client && npm run build --prefix client`
   - **Start Command:** `node server/server.js`
   - **Health Check Path:** `/api/health`
3. Em **Environment**, adicione `NODE_ENV` = `production` e `JWT_SECRET` = (Generate).

## Passo 3 — Secret file com o banco

1. No serviço: **Environment** → **Secret Files** → **Add Secret File**
2. **Filename:** `database.seed.b64`
3. **Contents:** o conteúdo do arquivo `server/database.seed.b64`
4. Salve. O Render monta o arquivo em `/etc/secrets/database.seed.b64`.

## Free x Starter (importante)

- **Free:** sem disco persistente. A cada deploy/restart banco e uploads voltam ao estado do secret file (dados novos são perdidos). O serviço hiberna após inatividade.
- **Starter (US$ 7/mês):** disco de 1 GB em `/var/data`, dados e fotos persistem. Para uso real com clientes, é o modo recomendado.

Para migrar para Starter depois: adicione um disco em `/var/data` e as variáveis `DB_PATH=/var/data/database.sqlite` e `UPLOADS_DIR=/var/data/uploads`.

## Primeiro acesso

- URL: `https://it-service-app.onrender.com`
- Usuário: `admin`
- Senha: a definida no banco enviado no secret file.

## Atualizações

```powershell
git add .
git commit -m "Atualização"
git push
```

O Render faz o deploy automático (`autoDeploy` ativo).

Ao mudar dados de clientes localmente e quiser publicá-los, gere novamente o `database.seed.b64` e atualize o secret file no Render.

## Problemas comuns

- **Build falhou:** confira os logs em **Logs → Build**. O comando precisa instalar `server` e `client`.
- **Tela branca:** confirme que `client/dist` foi gerado e que o start é `node server/server.js`.
- **Dados zerados após deploy:** é o comportamento do plano Free.
- **Logo quebrado:** o logo empacotado é copiado no primeiro boot; uploads feitos depois se perdem no restart (Free).
- **Health check falhando:** veja se o serviço iniciou na porta `PORT` (o Render injeta automaticamente).
