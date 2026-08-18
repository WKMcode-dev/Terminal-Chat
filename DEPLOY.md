# Hospedagem gratuita do Terminal Chat

O projeto está pronto para usar um PostgreSQL externo e executar o servidor em
um contêiner. A combinação mais simples sem mensalidade é:

- **Neon Free** para o PostgreSQL;
- **Koyeb Free** para o servidor quando houver cartão disponível para a
  verificação da conta; ou
- **Render Free** como alternativa sem cartão, aceitando um despertar mais
  demorado depois de períodos sem ninguém conectado.

O arquivo `Dockerfile` funciona nas duas hospedagens e o `render.yaml` permite
criar o serviço do Render como Blueprint.

## 1. Criar o PostgreSQL no Neon

1. Crie uma conta gratuita em <https://console.neon.tech/>.
2. Crie um projeto chamado `terminal-chat`.
3. Em **Connection details**, selecione a conexão **Pooled**.
4. Copie a URL completa. Ela deve terminar com `sslmode=require`, semelhante a:

   ```text
   postgresql://usuario:senha@ep-exemplo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

5. Guarde essa URL como segredo. Nunca publique-a no GitHub.

As tabelas são criadas automaticamente na primeira inicialização do servidor.

## 2A. Hospedar no Koyeb

1. Acesse <https://app.koyeb.com/> e conecte sua conta do GitHub.
2. Escolha **Create Web Service → GitHub** e selecione
   `WKMcode-dev/Terminal-Chat`.
3. Selecione **Dockerfile** como método de construção e mantenha o caminho
   `Dockerfile`.
4. Escolha a instância chamada **Free**, na região Washington, D.C.
5. Exponha a porta HTTP `3000` e configure o health check HTTP `/health`.
6. Adicione as variáveis:

   ```env
   NODE_ENV=production
   JWT_SECRET=gere-uma-chave-longa-e-aleatoria
   DATABASE_URL=cole-a-url-pooled-do-neon
   CORS_ORIGINS=http://tauri.localhost,https://tauri.localhost,tauri://localhost
   ```

7. Faça o deploy e copie o domínio HTTPS fornecido pelo Koyeb.

A instância gratuita dorme após uma hora totalmente sem tráfego, mas desperta
em poucos segundos. Enquanto algum cliente estiver conectado, o heartbeat do
Terminal Chat mantém o WebSocket saudável.

## 2B. Hospedar no Render sem cartão

1. Acesse <https://dashboard.render.com/> e conecte o GitHub.
2. Escolha **New → Blueprint** e selecione o repositório do Terminal Chat.
3. O Render encontrará o arquivo `render.yaml`.
4. No campo secreto `DATABASE_URL`, cole a URL Pooled do Neon.
5. Confirme que o serviço usa o tipo **Free** e faça o deploy.
6. Copie o domínio terminado em `.onrender.com`.

O Render gratuito dorme depois de 15 minutos sem tráfego e pode levar cerca de
um minuto para voltar. Os clientes desta versão aguardam esse despertar e
tentam se reconectar automaticamente. Enquanto uma pessoa estiver conectada,
o heartbeat envia tráfego WebSocket periódico.

## 3. Conectar os clientes

No aplicativo desktop, abra **Servidor** na tela de login e informe:

```text
https://dominio-fornecido-pela-hospedagem
```

No `.env` usado pelo cliente CLI:

```env
TERMINAL_CHAT_SERVER=wss://dominio-fornecido-pela-hospedagem/ws
VITE_API_URL=https://dominio-fornecido-pela-hospedagem
```

Depois execute normalmente:

```powershell
npm run dev
```

Para gerar o aplicativo desktop já apontando para a hospedagem:

```powershell
$env:VITE_API_URL="https://dominio-fornecido-pela-hospedagem"
npm run bundle:desktop
```

## Limite importante das chamadas

A voz atual usa áudio PCM transmitido pelo servidor. Ela funciona, mas consome
mais banda que Discord ou WebRTC. Para conversas longas e frequentes, prefira o
Koyeb por sua franquia maior ou use uma VM Always Free. A migração futura da voz
para Opus/WebRTC reduzirá bastante esse consumo.

## Diagnóstico

Abra no navegador:

```text
https://seu-dominio/health
```

A resposta esperada contém `"status":"ok"`, a versão do servidor e
`"storage":"postgres"`.
