# Histórico de versões

## 2.2.1

- instala explicitamente o provedor criptográfico `ring` antes de conexões TLS,
  eliminando o panic do `rustls` ao usar servidores `wss://`;
- faz o cliente CLI carregar `TERMINAL_CHAT_SERVER` diretamente do `.env`;
- permite que `npm run dev` use o servidor remoto sem aguardar um backend local;
- amplia o diagnóstico e o tempo de inicialização do servidor local no Windows;
- atualiza a recomendação de hospedagem após o encerramento do plano gratuito da
  Koyeb para novas contas.

## 2.2.0

- elimina a tela preta silenciosa do Tauri com recuperação de interface e erro
  de conexão visível;
- permite configurar o servidor hospedado diretamente na tela de login;
- libera conexões HTTPS/WSS no CSP do aplicativo desktop;
- adiciona heartbeat e espera de cold start para hospedagens gratuitas;
- adiciona busca e filtros para amigos, solicitações e bloqueios;
- adiciona seletor próprio de emojis no desktop e na CLI (`F10`/`Ctrl+E`);
- reconhece `Win+.` quando o terminal repassa a tecla à aplicação;
- prepara Dockerfile, Render Blueprint e guia Neon/Koyeb/Render;
- configura produção para escutar em `0.0.0.0` e mantém origens Tauri seguras.

## 2.1.0

- adiciona teste local de microfone com retorno e medidor na CLI (`F9`);
- adiciona o mesmo diagnóstico de áudio no cliente desktop;
- permite editar nome de exibição, avatar em emoji, bio, atividade e presença;
- implementa solicitações de amizade, aceite, recusa, cancelamento e remoção;
- implementa bloqueio e desbloqueio com proteção de mensagens e chamadas;
- conecta mensagens e chamadas aos cartões de perfil;
- persiste os novos dados em JSON e PostgreSQL;
- sincroniza perfis e amizades pelo WebSocket;
- mantém migração automática dos dados criados na versão 2.0.

## 2.0.0

- estabelece os clientes CLI e desktop sobre o mesmo servidor autenticado;
- adiciona mensagens, canais, histórico, presença e voz em tempo real;
- melhora compatibilidade com UTF-8, ABNT2 e terminais do Windows.
