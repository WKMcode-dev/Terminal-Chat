# Hospedagem gratuita do Terminal Chat

O projeto está pronto para usar um PostgreSQL externo e executar o servidor em
um contêiner. Para contas novas, a combinação gratuita recomendada é:

- **Neon Free** para o PostgreSQL; e
- **Render Free** para o servidor, sem cartão, aceitando um despertar mais
  demorado depois de períodos sem ninguém conectado.

Em fevereiro de 2026, a Koyeb anunciou que novas contas passariam a aceitar
somente planos pagos enquanto a plataforma é incorporada à Mistral AI. Por isso,
ela não é mais indicada neste guia como hospedagem gratuita. O comunicado está
em <https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure>.

O arquivo `Dockerfile` funciona em hospedagens de contêiner e o `render.yaml`
permite criar o serviço do Render como Blueprint.

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

## 2. Hospedar no Render sem cartão

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

O código distribuído pelo projeto já utiliza o servidor oficial
`https://terminal-chat-6pet.onrender.com` quando nenhuma configuração é
fornecida. Portanto, usuários comuns não precisam criar um arquivo `.env`.

As instruções abaixo são necessárias somente para quem publicar outra instância
do Terminal Chat.

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
mais banda que Discord ou WebRTC. Para conversas longas e frequentes, monitore a
franquia de saída do Render ou use uma VM com maior transferência. A migração
futura da voz para Opus/WebRTC reduzirá bastante esse consumo.

## Diagnóstico

Abra no navegador:

```text
https://seu-dominio/health
```

A resposta esperada contém `"status":"ok"`, a versão do servidor e
`"storage":"postgres"`.
