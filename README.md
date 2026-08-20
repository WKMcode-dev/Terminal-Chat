# 💬 Terminal Chat v2.4.0

Chat em tempo real com dois clientes: uma interface completa no terminal e um
aplicativo desktop em Tauri. Ambos usam o mesmo servidor, as mesmas contas, os
mesmos canais, o mesmo histórico e as mesmas salas de voz.

> Esta versão não carrega usuários ou mensagens demonstrativas. O canal
> `#geral` é criado vazio na primeira inicialização e todo o conteúdo posterior
> vem do banco real.

## ✨ O que já funciona

- cadastro, login e restauração segura da sessão;
- mensagens diretas somente entre amigos e canais em tempo real por WebSocket;
- criação, histórico, edição e exclusão de mensagens próprias;
- conversas fecháveis sem apagar o histórico, reabertas ao enviar nova mensagem;
- histórico persistente e idempotência contra mensagens duplicadas;
- presença online, ausente, ocupado e offline com bolinhas coloridas;
- reconexão automática e sincronização completa após uma queda;
- criação de canais;
- voz PCM16 otimizada em tempo real entre terminal e desktop;
- microfone, silenciamento de áudio e contagem de participantes;
- teste local do microfone com retorno da voz e medidor de nível;
- perfis editáveis com avatar em emoji, bio e atividade;
- solicitações de amizade, aceite, remoção, bloqueio e desbloqueio;
- busca por nome ou `@usuário` e filtros de amigos, solicitações e bloqueios;
- logout e troca de conta sem precisar fechar o terminal;
- exclusão protegida por frase de confirmação e senha, com remoção permanente;
- abertura de conversas e chamadas diretamente pelos perfis;
- seletor interno de emojis no terminal e no desktop;
- interface CLI responsiva, UTF-8 e compatível com teclado ABNT2;
- interface desktop responsiva com três paletas e controle de animações;
- recuperação visível de erros do Tauri, sem permanecer em uma tela preta;
- seleção do servidor local ou hospedado diretamente na tela de login;
- persistência local pronta para uso ou PostgreSQL para implantação;
- Dockerfile e configuração de deploy para hospedagem gratuita;
- validação compartilhada de todos os eventos pelo protocolo v3.

## 📦 Instalar para usar

Amigos e usuários finais não precisam receber o código-fonte nem instalar
Node.js ou Rust. A página **Releases** do GitHub oferece dois arquivos:

- instalador desktop `Terminal-Chat-Desktop-...-Setup.exe`;
- CLI portátil `Terminal-Chat-CLI-...zip`.

Os dois já apontam para o servidor oficial e funcionam sem `.env`. Consulte
[DISTRIBUTION.md](DISTRIBUTION.md) para instalação, hashes, SmartScreen e o
checklist de teste antes de publicar uma versão.

## 🚀 Executar o código no Windows

Requisitos:

- Node.js 22.12 ou superior;
- Rust com Cargo pelo `rustup`;
- Microsoft C++ Build Tools, exigido pelo Tauri e pelas bibliotecas de áudio;
- WebView2, normalmente já presente no Windows 11.

No PowerShell, dentro da pasta do projeto:

```powershell
npm install
npm run dev
```

O comando já conecta a CLI e o desktop ao servidor oficial da comunidade:

```text
https://terminal-chat-6pet.onrender.com
```

Não é necessário criar `.env`, informar endereços ou iniciar um banco. Na
primeira execução, escolha **Criar conta**. A mesma conta pode ser usada em
qualquer computador e também no aplicativo desktop.

Para desenvolver o backend em um ambiente local e isolado, use:

```powershell
npm run dev:local
```

Contas criadas no modo local ficam somente naquele computador e não aparecem no
servidor oficial. Variáveis em `.env` continuam disponíveis apenas como
sobrescritas avançadas para outro servidor.

Os logs dos processos auxiliares ficam em `.dev-logs`. O terminal original é
restaurado mesmo quando a interface encontra um erro.

## 💾 Banco de dados

### Desenvolvimento local

Ao executar `npm run dev:local`, o backend usa, sem configuração adicional, um
repositório JSON transacional em:

```text
.terminal-chat/data.json
```

O arquivo é persistente, escrito atomicamente e criado com permissão restrita.
Ele é um banco local real, não um modo de exemplo.

### PostgreSQL

Para equipes ou implantação, copie `.env.example` para `.env`, defina uma chave
JWT longa e habilite `DATABASE_URL`:

```env
JWT_SECRET=coloque-aqui-uma-chave-longa-e-aleatoria
DATABASE_URL=postgres://terminal_chat:terminal_chat@127.0.0.1:5432/terminal_chat
```

O PostgreSQL incluído pode ser iniciado com:

```powershell
docker compose up -d postgres
npm run dev:local
```

As tabelas, índices, associação ao canal inicial e restrições de unicidade são
preparados automaticamente pelo servidor.

## ⌨️ Navegação no terminal

| Atalho                     | Ação                                        |
| -------------------------- | ------------------------------------------- |
| `1`, `2`, `3`, `4`         | Abre uma área quando Navegação está focada  |
| `Ctrl+←` / `Ctrl+→`        | Alterna globalmente entre as áreas          |
| `H` / `L`                  | Alterna áreas dentro do painel Navegação    |
| `Tab` / `Shift+Tab`        | Percorre os painéis atuais                  |
| `↑` / `↓` ou `J` / `K`     | Navega por itens e mensagens                |
| `Page Up` / `Page Down`    | Percorre o histórico                        |
| `Home` / `End`             | Primeira ou última mensagem                 |
| `Enter`                    | Abre ou envia                               |
| `F1`                       | Ajuda completa                              |
| `F2`                       | Ativa ou silencia o microfone               |
| `F3`                       | Ativa ou silencia a reprodução de áudio     |
| `F4`                       | Entra ou sai da voz da conversa/canal atual |
| `F9`                       | Testa o microfone com retorno e medidor     |
| `Win+.` / `F10` / `Ctrl+E` | Abre o seletor interno de emojis            |
| `/` / `Ctrl+F`             | Busca usuários na área Perfis               |
| `Ctrl+C`                   | Copia a mensagem selecionada                |
| `E`                        | Edita sua mensagem selecionada              |
| `D` duas vezes             | Exclui sua mensagem selecionada             |
| `X`                        | Fecha a conversa direta selecionada         |
| `Ctrl+Q`                   | Encerra o aplicativo                        |
| `Ctrl+Shift+Q`             | Sai da conta e volta ao login               |

`F5–F8`, `Alt+1–4`, `Ctrl+1–4` e `Ctrl+Tab` continuam como aliases quando o
terminal os transmitir. A navegação principal evita depender deles porque CMD e
PowerShell podem interceptar essas combinações.

Também existem os comandos `/conversas`, `/canais`, `/perfis`, `/config`,
`/ajuda`, `/sair` (logout) e `/quit` (fechar o aplicativo).

## 👥 Perfis e amizades

No desktop, abra **Perfis** para editar seu nome de exibição, avatar em emoji,
bio, atividade e presença. A busca encontra pessoas pelo nome ou `@usuário`, e
as abas separam amigos, solicitações e bloqueios. Os cartões permitem adicionar,
aceitar, recusar, remover, bloquear e desbloquear usuários. Os botões
**Mensagem** e **Chamar** aparecem após a amizade ser aceita e abrem o contato
diretamente. Uma conta existente continua encontrável na busca, mas não entra
na lista de conversas antes disso.

Na CLI, selecione um perfil e use:

| Tecla | Ação contextual                          |
| ----- | ---------------------------------------- |
| `A`   | Adiciona ou aceita uma solicitação       |
| `R`   | Recusa, cancela ou remove uma amizade    |
| `B`   | Bloqueia ou desbloqueia o usuário        |
| `M`   | Abre a conversa direta com um amigo      |
| `F4`  | Inicia ou encerra a chamada com um amigo |

Pressione `/` ou `Ctrl+F` em **Perfis**, digite parte do nome ou o
`@usuário` e confirme com `Enter`. `Esc` limpa a busca e, quando ela já estiver
vazia, retorna à lista.

Perfis, amizades e bloqueios são persistidos tanto no armazenamento local
quanto no PostgreSQL e sincronizados em tempo real entre CLI e desktop.

Remover uma amizade ou bloquear alguém fecha a conversa para os dois lados.
Fechar somente pelo `X` esconde a conversa apenas da sua lista e preserva todo
o histórico; uma nova mensagem ou a ação **Mensagem** a abre novamente.

## ✏️ CRUD de conversas e mensagens

O envio aparece imediatamente na interface como pendente e é confirmado pelo
servidor sem duplicar o texto. O autor pode editar ou excluir sua própria
mensagem; os outros participantes recebem a mudança em tempo real. Mensagens
editadas exibem essa indicação e mensagens excluídas deixam de fazer parte do
histórico persistido.

No desktop, passe o mouse sobre sua mensagem para usar **Editar** ou **Excluir**.
Na CLI, selecione a mensagem e pressione `E` para editar ou `D` duas vezes para
confirmar a exclusão. Use `X` na lista ou no conteúdo de uma conversa direta
para fechá-la. Canais compartilhados não podem ser fechados dessa forma.

## 🔑 Conta, logout e exclusão

Na CLI, abra **Configurações** e selecione **Sair e trocar conta** para remover
a sessão salva no Gerenciador de Credenciais do Windows e voltar ao login. O
atalho `Ctrl+Shift+Q` e o comando `/sair` abrem a mesma confirmação. `Ctrl+Q` e
`/quit` apenas fecham o programa e preservam a sessão.

**Excluir conta** fica no final das Configurações da CLI e na área de conta do
desktop. Para impedir exclusões acidentais, o aplicativo exige duas etapas:

1. digitar exatamente `EXCLUIR @seu_usuario`;
2. confirmar a senha atual.

A exclusão é permanente. O servidor remove perfil, mensagens, amizades e
associações de canais do JSON ou PostgreSQL, encerra todas as sessões da conta
e informa os demais clientes em tempo real.

## 🔤 Acentos e símbolos

O compositor trabalha em UTF-8 e preserva acentos, `ç`, `?`, `@`, símbolos,
combinações de `AltGr` e emojis. Colagens com várias linhas são normalizadas sem
quebrar limites Unicode. Como o modo bruto de alguns terminais do Windows pode
interceptar `Win+.`, a CLI oferece o seletor próprio em `F10` e `Ctrl+E`. O
desktop também possui um botão de emojis ao lado do campo de mensagem.

Em **Configurações → Símbolos decorativos → Simplificado**, bordas e seletores
são simplificados, mas os estados continuam usando as bolinhas:

| Estado  | Indicador    |
| ------- | ------------ |
| Online  | `●` verde    |
| Ausente | `●` amarelo  |
| Ocupado | `●` vermelho |
| Offline | `○` cinza    |

## 🎙️ Voz

No terminal, abra uma conversa ou canal e pressione `F4`. No desktop, use o
botão **Entrar** na barra de voz. O aplicativo solicitará acesso ao microfone.

Pressione `F9` para iniciar um teste inteiramente local: sua voz retorna pela
saída de áudio e o medidor confirma o nível capturado. Use fones de ouvido para
evitar microfonia e pressione `F9` novamente para encerrar. O teste não envia
áudio ao servidor e não pode permanecer ativo durante uma chamada.

O áudio usa PCM16 mono a 24 kHz, reamostragem no cliente e controle de fluxo no
servidor. Isso reduz o tráfego típico em aproximadamente 75% em relação ao PCM
`f32` anterior. Quadros de voz passam somente pelo WebSocket em memória: eles
não são gravados no Neon nem no armazenamento JSON. Salas de canal exigem
associação ao canal; salas diretas exigem uma amizade aceita.

Durante a transição, o protocolo negocia o codec e o servidor converte o áudio
para clientes 2.3.2 ainda conectados. Para obter a economia completa, atualize
todos os clientes para a versão 2.4.0.

Para produção pública ou grupos muito grandes, a evolução recomendada é trocar o
transporte PCM por Opus/WebRTC ou LiveKit, mantendo os mesmos eventos de sala. A
dependência será adicionada quando essa migração for implementada, para não
inflar nem ampliar a superfície do servidor atual sem necessidade.

## ☁️ Servidor online gratuito

O servidor oficial já vem configurado na CLI e no desktop e usa Neon PostgreSQL
com Render Free. O servidor inclui Dockerfile, health check, heartbeat
WebSocket, espera de cold start e reconexão automática. O guia
[DEPLOY.md](DEPLOY.md) ensina a publicar outra comunidade; nesse caso, o endereço
pode ser informado na tela de login do desktop ou sobrescrito pelas variáveis
`VITE_API_URL` e `TERMINAL_CHAT_SERVER`.

As opções gratuitas podem dormir quando ninguém estiver conectado. Elas voltam
automaticamente na próxima conexão, portanto ficam acessíveis a qualquer hora,
mas não oferecem o mesmo SLA de uma hospedagem paga.

## 🧱 Arquitetura

```text
backend/protocol     Schemas Zod e eventos v3 compartilhados
backend/server       Fastify, JWT, WebSocket e repositórios
frontend/cli         Rust, Ratatui, Crossterm e CPAL
frontend/desktop     React, Vite e interface responsiva
frontend/desktop/src-tauri  Empacotamento nativo Tauri
```

O servidor oferece:

- `GET /health`;
- `POST /auth/register`;
- `POST /auth/login`;
- `GET /bootstrap` com token Bearer;
- `DELETE /account` com token Bearer, senha e confirmação;
- `POST /channels` com token Bearer;
- `GET /ws` para eventos autenticados em tempo real.

## 🔐 Segurança aplicada

- senhas protegidas com Argon2id;
- JWT com validade de sete dias e segredo obrigatório em produção;
- limites de tentativas, mensagens, tamanho de payload e tráfego de voz;
- validação Zod antes de qualquer evento chegar à regra de negócio;
- CORS restrito, CSP no Tauri e ausência de autenticação por cookies;
- autorização de canais e salas de voz no servidor;
- escrita atômica do repositório local;
- consultas PostgreSQL parametrizadas;
- React escapa o conteúdo das mensagens, reduzindo risco de XSS.

Nunca publique `.env`, `.terminal-chat`, tokens ou arquivos de dados no Git.

## 🧪 Validação

```powershell
npm test
npm run typecheck
npm run build
```

Os testes cobrem contratos UTF-8, limites de payload, cadastro, login, sessões,
proteção de rotas, persistência e envio real por WebSocket. O cliente Rust inclui
testes para entrada Unicode, navegação, atalhos, responsividade e reamostragem de
áudio.

Para gerar o instalador desktop:

```powershell
npm run release:windows
```

O comando executa a validação completa e grava o instalador NSIS, a CLI portátil
e os hashes SHA-256 em `artifacts\windows\vX.Y.Z`. O workflow **Windows
Release** executa o mesmo processo no GitHub Actions e publica os arquivos ao
receber uma tag `vX.Y.Z`.
