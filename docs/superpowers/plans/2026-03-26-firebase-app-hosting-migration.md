# Firebase App Hosting Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o projeto Power Fatu da Vercel para o Firebase App Hosting com deploy automático via GitHub na branch `main`.

**Architecture:** `apphosting.yaml` na raiz controla o runtime (Cloud Run gerenciado). Variáveis públicas ficam em texto no YAML; variáveis do Admin SDK ficam no Secret Manager e são referenciadas por nome. O Firebase App Hosting detecta Next.js automaticamente e executa o build.

**Tech Stack:** Firebase CLI ≥ 13.15.4, Firebase App Hosting, Cloud Run, Secret Manager, Next.js 16 App Router, Firebase Admin SDK 13.

> **⚠️ Atenção:** O ID real do projeto Firebase é `pfat-cfc0c` (display name "Pfat"). Use `pfat-cfc0c` em todos os comandos CLI.

---

## Mapeamento de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `apphosting.yaml` | **Criar** | Configuração de runtime e env vars do App Hosting |
| `firebase.json` | **Modificar** | Nenhuma alteração de código — já correto |
| `next.config.ts` | **Nenhuma alteração** | Já compatível (sem `output: export`) |

---

## Task 1: Verificar pré-requisitos do Firebase CLI

**Files:**
- Nenhum arquivo modificado

- [ ] **Step 1: Verificar versão do Firebase CLI**

```bash
firebase --version
```

Esperado: versão `≥ 13.15.4`. Se menor, atualizar:

```bash
npm install -g firebase-tools@latest
```

- [ ] **Step 2: Verificar login e projeto ativo**

```bash
firebase projects:list
```

Esperado: projeto `pfat` aparece na lista com seu ID.

- [ ] **Step 3: Selecionar o projeto pfat**

```bash
firebase use pfat
```

Esperado:
```
Now using project pfat
```

---

## Task 2: Criar os secrets no Secret Manager

Os três secrets do Firebase Admin SDK devem existir no Secret Manager **antes** do `apphosting.yaml` ser commitado, pois o App Hosting valida as referências durante o setup.

Os valores estão no arquivo JSON da conta de serviço: Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.

**Files:**
- Nenhum arquivo modificado (secrets ficam no Secret Manager, fora do repo)

- [ ] **Step 1: Criar secret do project ID**

```bash
firebase apphosting:secrets:set firebase-admin-project-id --project pfat-cfc0c
```

Quando solicitado, cole o valor do campo `"project_id"` do JSON da conta de serviço.

Esperado:
```
✔  Created new secret projects/.../secrets/firebase-admin-project-id
```

- [ ] **Step 2: Criar secret do client email**

```bash
firebase apphosting:secrets:set firebase-admin-client-email --project pfat-cfc0c
```

Quando solicitado, cole o valor do campo `"client_email"` do JSON da conta de serviço.

Esperado:
```
✔  Created new secret projects/.../secrets/firebase-admin-client-email
```

- [ ] **Step 3: Criar secret da private key**

```bash
firebase apphosting:secrets:set firebase-admin-private-key --project pfat-cfc0c
```

Quando solicitado, cole o valor **completo** do campo `"private_key"` do JSON, incluindo os `\n` literais:
```
-----BEGIN PRIVATE KEY-----\nMIIEvA...(conteúdo)...\n-----END PRIVATE KEY-----\n
```

Esperado:
```
✔  Created new secret projects/.../secrets/firebase-admin-private-key
```

- [ ] **Step 4: Verificar os três secrets**

```bash
firebase apphosting:secrets:list --project pfat-cfc0c
```

Esperado: os três secrets aparecem na listagem:
```
firebase-admin-project-id
firebase-admin-client-email
firebase-admin-private-key
```

- [ ] **Step 5: Commit (nenhum arquivo alterado — só checkpoint)**

```bash
git status
```

Esperado: `nothing to commit, working tree clean`

---

## Task 3: Criar o `apphosting.yaml`

**Files:**
- Criar: `apphosting.yaml` (raiz do projeto)

- [ ] **Step 1: Obter os valores das variáveis públicas**

No Firebase Console → Configurações do projeto → Seus apps → selecionar o app web.

Copie os valores do objeto `firebaseConfig`:
```
apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
```

- [ ] **Step 2: Criar o arquivo `apphosting.yaml`**

Crie o arquivo na raiz do projeto com os valores reais substituídos:

```yaml
# apphosting.yaml
runConfig:
  concurrency: 80
  cpu: 1
  memoryMiB: 512
  minInstances: 0

env:
  # Variáveis públicas — client SDK (expostas no bundle do browser)
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: "AIzaSy..."          # substituir pelo valor real
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: "pfat.firebaseapp.com"
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: "pfat"
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: "pfat.firebasestorage.app"
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "..."               # substituir pelo valor real
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: "1:..."             # substituir pelo valor real

  # Variáveis sensíveis — Admin SDK (Secret Manager)
  - variable: FIREBASE_ADMIN_PROJECT_ID
    secret: firebase-admin-project-id
  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
```

- [ ] **Step 3: Verificar que nenhuma variável ficou com placeholder**

```bash
grep -n "\.\.\." apphosting.yaml
```

Esperado: nenhum resultado. Se houver resultado, preencher os valores faltantes antes de continuar.

- [ ] **Step 4: Rodar os testes existentes para garantir que o código está íntegro**

```bash
npm test -- --passWithNoTests
```

Esperado: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add apphosting.yaml
git commit -m "feat: add apphosting.yaml for Firebase App Hosting"
```

---

## Task 4: Criar o backend do Firebase App Hosting e conectar o GitHub

Este passo é feito **pelo Firebase Console** (UI) pois o fluxo de autorização OAuth com o GitHub exige interação browser.

**Files:**
- Nenhum arquivo modificado

- [ ] **Step 1: Acessar o Firebase Console**

Abra: [https://console.firebase.google.com/project/pfat/apphosting](https://console.firebase.google.com/project/pfat/apphosting)

- [ ] **Step 2: Criar o backend**

Clique em **"Get started"** → **"Connect to GitHub"**.

Autorize o Firebase a acessar o repositório do projeto (budswarez/Power-Fatu ou equivalente).

- [ ] **Step 3: Configurar o backend**

Preencha os campos:
- **Repository:** selecionar o repositório do projeto
- **Branch:** `main`
- **Root directory:** `/` (raiz do projeto)
- **Backend ID:** `power-fatu-production`
- **Region:** `us-central1` (ou a mais próxima disponível)

- [ ] **Step 4: Conceder acesso dos secrets ao backend**

Após criar o backend, execute para cada secret:

```bash
firebase apphosting:secrets:grantaccess firebase-admin-project-id \
  --backend power-fatu-production --project pfat-cfc0c

firebase apphosting:secrets:grantaccess firebase-admin-client-email \
  --backend power-fatu-production --project pfat-cfc0c

firebase apphosting:secrets:grantaccess firebase-admin-private-key \
  --backend power-fatu-production --project pfat-cfc0c
```

Esperado para cada comando:
```
✔  Granted access to secret ... for backend power-fatu-production
```

- [ ] **Step 5: Verificar que o backend foi criado**

```bash
firebase apphosting:backends:list --project pfat-cfc0c
```

Esperado: backend `power-fatu-production` aparece com status `ACTIVE`.

---

## Task 5: Validar o primeiro deploy

- [ ] **Step 1: Disparar o deploy fazendo push na main**

O backend já monitora a branch `main`. Se o `apphosting.yaml` já foi commitado e pushed, o build pode já ter iniciado. Verifique:

```bash
git log --oneline -3
git push origin main
```

- [ ] **Step 2: Acompanhar o build no Console**

No Firebase Console → App Hosting → power-fatu-production → **Builds**.

O build do Next.js leva ~3-5 minutos. Aguarde o status mudar para `SUCCEEDED`.

Se o build falhar, verifique os logs no Console e corrija antes de continuar.

- [ ] **Step 3: Obter a URL de produção**

```bash
firebase apphosting:backends:list --project pfat-cfc0c
```

A URL aparece no campo `domains` no formato:
```
https://power-fatu--power-fatu-production-<HASH>.us-central1.hosted.app
```

- [ ] **Step 4: Smoke test — verificar login**

Abra a URL no browser e execute os seguintes testes manuais:

1. A página de login carrega sem erros no console do browser
2. Login com um usuário existente funciona (Firebase Auth)
3. O dashboard carrega dados do Firestore corretamente
4. A tela de gestão de usuários carrega (valida o Firebase Admin SDK no server-side)

- [ ] **Step 5: Verificar variáveis de ambiente no runtime**

Se alguma feature não funcionar, verifique os logs do Cloud Run:

Firebase Console → App Hosting → power-fatu-production → **Logs**

Erros comuns:
- `FIREBASE_ADMIN_PRIVATE_KEY` com formato incorreto → recriar o secret com a chave no formato correto
- `app/duplicate-app` → já tratado pelo código com `getApps().length` check

---

## Task 6: Desativar a Vercel

Só executar este passo **após** validar o smoke test do Task 5.

**Files:**
- Nenhum arquivo modificado

- [ ] **Step 1: Acessar o projeto na Vercel**

Abra: [https://vercel.com/dashboard](https://vercel.com/dashboard) → selecionar o projeto Power Fatu.

- [ ] **Step 2: Pausar ou deletar o projeto**

- **Opção pausa:** Settings → Advanced → **Pause Project** (mantém configurações, para o deploy)
- **Opção delete:** Settings → Advanced → **Delete Project** (irreversível)

Recomendado: pausar primeiro, deletar após uma semana de funcionamento estável no Firebase.

- [ ] **Step 3: Confirmar que o ambiente Firebase é o único ativo**

Acesse a URL do Firebase e confirme que a aplicação está funcionando normalmente.

```bash
# Checkpoint final
firebase apphosting:backends:list --project pfat-cfc0c
```

Esperado: backend `power-fatu-production` com status `ACTIVE` e URL de produção.

---

## Resumo de arquivos criados/modificados

| Arquivo | Alteração |
|---------|-----------|
| `apphosting.yaml` | Criado — configuração de runtime e env vars |
| Secret Manager | 3 secrets criados (fora do repo) |
| Firebase Console | Backend criado e GitHub conectado |
| Vercel | Projeto pausado/deletado |

---

## Rollback

Se algo der errado antes de desativar a Vercel, o projeto continua 100% funcional na Vercel. Basta não desativar a Vercel e investigar os logs do Firebase App Hosting.
