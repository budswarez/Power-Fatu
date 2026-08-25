# Design: Migração Vercel → Firebase App Hosting

**Data:** 2026-03-26
**Projeto:** Power Fatu — Projeção de Faturamento
**Firebase Project:** pfat
**Status:** Aprovado

---

## Contexto

O projeto Power Fatu (Next.js 16 App Router) está atualmente hospedado na Vercel usando o domínio padrão (`*.vercel.app`). O Firebase já é utilizado para Auth e Firestore. O objetivo é consolidar toda a infraestrutura no Firebase, usando o Firebase App Hosting para servir a aplicação Next.js.

Não há domínio customizado — nenhuma migração de DNS é necessária.

---

## Abordagem escolhida: Migração direta (big bang)

Configurar o Firebase App Hosting do zero, migrar todas as variáveis de ambiente, conectar o GitHub e desativar a Vercel em um único ciclo de trabalho. Sem infraestrutura paralela.

**Justificativa:** Sem domínio customizado, não há motivo para manter os dois ambientes simultâneos. A ordem de execução segura (validar Firebase antes de desativar Vercel) elimina o risco de downtime.

---

## Arquitetura

```
GitHub (branch: main)
       │
       │  push
       ▼
Firebase App Hosting (Cloud Build trigger automático)
       │
       ├── Build: Next.js 16 (detectado automaticamente)
       │
       └── Runtime: Cloud Run (gerenciado)
                 │
                 ├── Firebase Auth (client SDK)
                 ├── Cloud Firestore (client SDK)
                 └── Firebase Admin SDK (server-side: /api/users/[uid])
```

O Firebase App Hosting executa o Next.js em Cloud Run gerenciado. O framework é detectado automaticamente — nenhuma configuração de container é necessária.

---

## Configuração: `apphosting.yaml`

Arquivo commitado na raiz do repositório. Contém variáveis públicas em texto e referências a secrets para variáveis sensíveis.

```yaml
runConfig:
  concurrency: 80
  cpu: 1
  memoryMiB: 512
  minInstances: 0

env:
  # Variáveis públicas — client SDK (expostas no bundle do browser)
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: "<preencher antes do commit>"
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: "pfat.firebaseapp.com"
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: "pfat"
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: "pfat.appspot.com"
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "<preencher antes do commit>"
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: "<preencher antes do commit>"

  # Variáveis sensíveis — Admin SDK (armazenadas no Secret Manager)
  - variable: FIREBASE_ADMIN_PROJECT_ID
    secret: firebase-admin-project-id
  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
```

---

## Secrets (Secret Manager)

Os três secrets do Admin SDK são criados via Firebase CLI e nunca entram no repositório:

```bash
firebase apphosting:secrets:set firebase-admin-project-id
firebase apphosting:secrets:set firebase-admin-client-email
firebase apphosting:secrets:set firebase-admin-private-key
```

Os valores são obtidos do arquivo JSON da conta de serviço gerado no Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.

**Atenção:** `FIREBASE_ADMIN_PRIVATE_KEY` deve ser colada com os `\n` literais, no formato:
```
-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

---

## Pipeline de Deploy

| Evento | Ação |
|--------|------|
| `push` na `main` | Cloud Build dispara automaticamente |
| Build bem-sucedido | Novo revision do Cloud Run recebe tráfego |
| Build com falha | Revision anterior continua servindo |

A conexão GitHub é configurada pelo Console do Firebase — não requer GitHub Actions manual.

**URL de produção gerada:**
```
https://power-fatu--pfat-<HASH>.<REGION>.hosted.app
```

---

## Ordem de Execução da Migração

1. Criar secrets no Secret Manager via CLI
2. Criar o arquivo `apphosting.yaml` com os valores das variáveis públicas preenchidos
3. Conectar o backend do Firebase App Hosting ao repositório GitHub via Console
4. Aguardar o primeiro build e validar a URL do Firebase
5. Desativar o projeto na Vercel

**A Vercel só é desativada após validação do ambiente Firebase.**

---

## O que não muda

- Código da aplicação: zero alterações necessárias
- Firebase Auth e Firestore: já configurados
- Firestore rules e indexes: já configurados
- Variáveis de ambiente: mesmas 9 variáveis, novos destinos de armazenamento

---

## Fora de escopo

- Preview Channels (pode ser adicionado como melhoria futura)
- Domínio customizado
- Configuração de Cloud CDN ou cache customizado
