# Histórico de versões

## 2.4.0

- restringe conversas diretas, mensagens, digitação e voz a amizades aceitas;
- impede que contas recém-criadas apareçam automaticamente na lista de
  conversas de todos os usuários;
- adiciona abrir e fechar conversas sem apagar o histórico, com sincronização
  entre CLI, desktop, JSON local e PostgreSQL/Neon;
- remove a conversa dos dois participantes ao desfazer uma amizade ou bloquear
  alguém e encerra qualquer sala de voz direta ativa entre eles;
- completa o CRUD das mensagens próprias com criação otimista, leitura do
  histórico, edição, exclusão e indicadores de envio pendente ou editado;
- reduz o áudio novo de PCM `f32` na taxa nativa para PCM16 mono a 24 kHz,
  diminuindo em aproximadamente 75% o tráfego típico sem gravar voz no banco;
- negocia a versão do protocolo e converte áudio por destinatário para manter
  clientes 2.3.2 funcionando enquanto a atualização é distribuída;
- adiciona migrações automáticas e não destrutivas para `edited_at` e
  `hidden_conversations` no Neon/PostgreSQL;
- aproxima a navegação do Discord com conversas fecháveis, ações contextuais
  de editar/excluir e acesso a mensagens/chamadas apenas entre amigos;
- amplia os testes de protocolo, persistência, autorização social, CRUD de
  mensagens e conversão de áudio.

## 2.3.2

- adiciona um pipeline Windows reproduzível para gerar instalador NSIS e CLI
  portátil sem exigir Node.js ou Rust dos amigos;
- adiciona GitHub Actions para validar, compilar, armazenar artifacts e criar uma
  Release ao publicar uma tag de versão;
- fixa e revisa os únicos scripts de instalação npm necessários, impedindo que
  `argon2` ou `esbuild` sejam silenciosamente bloqueados em uma instalação limpa;
- adiciona verificação combinatória de versões, URLs oficiais, empacotamento,
  WebView2, ícones, segredos ignorados e dependências com install scripts;
- configura o instalador desktop somente como NSIS por usuário, em português e
  inglês, sem exigir privilégios administrativos;
- remove dependências de servidor que não eram utilizadas e reduz a superfície
  de instalação e auditoria do pacote de produção;
- faz o endpoint `/health` consultar também o PostgreSQL/Neon e serializa os
  eventos recebidos por cada conexão WebSocket, inclusive autenticação e ping;
- migra automaticamente usuários antigos para os canais existentes tanto no
  arquivo JSON quanto no PostgreSQL, sem apagar mensagens ou perfis;
- compila o pacote compartilhado de protocolo antes da suíte de testes,
  permitindo que o workflow funcione também em um checkout limpo do GitHub;
- calcula os hashes por meio da API criptográfica do .NET, sem depender do
  cmdlet opcional `Get-FileHash` no runner Windows;
- gera hashes SHA-256 e documenta o limite de distribuição sem assinatura de
  código perante SmartScreen e Controle Inteligente de Aplicativos.

## 2.3.1

- configura o servidor oficial Render + Neon como padrão interno da CLI e do
  desktop;
- permite que amigos entrem com `npm run dev` sem criar ou editar `.env`;
- adiciona `npm run dev:local` para iniciar deliberadamente um backend isolado;
- mantém a seleção manual e as variáveis de ambiente como sobrescritas para
  comunidades próprias;
- documenta claramente que contas locais e online pertencem a bancos distintos.

## 2.3.0

- adiciona busca instantânea de usuários por nome ou `@usuário` na CLI com
  `/` ou `Ctrl+F`;
- exibe **Sair e trocar conta** nas configurações da CLI e remove corretamente
  a credencial salva antes de voltar ao login;
- separa `/sair` (logout) de `/quit` (fechar o aplicativo);
- adiciona exclusão permanente de conta na CLI e no desktop;
- protege a exclusão em duas etapas, exigindo a frase `EXCLUIR @usuario` e a
  senha atual;
- remove em cascata perfil, mensagens, amizades e associações de canais no JSON
  local e no PostgreSQL/Neon;
- encerra todas as conexões da conta excluída e sincroniza a remoção com os
  outros usuários em tempo real;
- adiciona testes de protocolo, autenticação, persistência, busca e confirmação
  das ações de conta.

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
