# 💬 Terminal Chat v2.1

Chat em tempo real com dois clientes: uma interface completa no terminal e um
aplicativo desktop em Tauri. Ambos usam o mesmo servidor, as mesmas contas, os
mesmos canais, o mesmo histórico e as mesmas salas de voz.

> Esta versão não carrega usuários ou mensagens demonstrativas. O canal
> `#geral` é criado vazio na primeira inicialização e todo o conteúdo posterior
> vem do banco real.

## ✨ O que já funciona

- cadastro, login e restauração segura da sessão;
- mensagens diretas e canais em tempo real por WebSocket;
- histórico persistente e idempotência contra mensagens duplicadas;
- presença online, ausente, ocupado e offline com bolinhas coloridas;
- reconexão automática e sincronização completa após uma queda;
- criação de canais;
- voz PCM em tempo real entre terminal e desktop;
- microfone, silenciamento de áudio e contagem de participantes;
- teste local do microfone com retorno da voz e medidor de nível;
- perfis editáveis com avatar em emoji, bio e atividade;
- solicitações de amizade, aceite, remoção, bloqueio e desbloqueio;
- abertura de conversas e chamadas diretamente pelos perfis;
- interface CLI responsiva, UTF-8 e compatível com teclado ABNT2;
- interface desktop responsiva com três paletas e controle de animações;
- persistência local pronta para uso ou PostgreSQL para implantação;
- validação compartilhada de todos os eventos pelo protocolo v2.

## 🚀 Executar no Windows

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

O comando compila o protocolo, inicia servidor e desktop em segundo plano,
espera a API ficar saudável e abre o cliente CLI no terminal atual. Na primeira
execução, escolha **Criar conta**. A mesma conta pode ser usada no desktop.

Os logs dos processos auxiliares ficam em `.dev-logs`. O terminal original é
restaurado mesmo quando a interface encontra um erro.

## 💾 Banco de dados

### Início imediato

Sem configuração adicional, o servidor usa um repositório JSON transacional em:

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
npm run dev
```

As tabelas, índices, associação ao canal inicial e restrições de unicidade são
preparados automaticamente pelo servidor.

## ⌨️ Navegação no terminal

| Atalho                  | Ação                                        |
| ----------------------- | ------------------------------------------- |
| `1`, `2`, `3`, `4`      | Abre uma área quando Navegação está focada  |
| `Ctrl+←` / `Ctrl+→`     | Alterna globalmente entre as áreas          |
| `H` / `L`               | Alterna áreas dentro do painel Navegação    |
| `Tab` / `Shift+Tab`     | Percorre os painéis atuais                  |
| `↑` / `↓` ou `J` / `K`  | Navega por itens e mensagens                |
| `Page Up` / `Page Down` | Percorre o histórico                        |
| `Home` / `End`          | Primeira ou última mensagem                 |
| `Enter`                 | Abre ou envia                               |
| `F1`                    | Ajuda completa                              |
| `F2`                    | Ativa ou silencia o microfone               |
| `F3`                    | Ativa ou silencia a reprodução de áudio     |
| `F4`                    | Entra ou sai da voz da conversa/canal atual |
| `F9`                    | Testa o microfone com retorno e medidor     |
| `Ctrl+C`                | Copia a mensagem selecionada                |
| `Ctrl+Q`                | Encerra o aplicativo                        |

`F5–F8`, `Alt+1–4`, `Ctrl+1–4` e `Ctrl+Tab` continuam como aliases quando o
terminal os transmitir. A navegação principal evita depender deles porque CMD e
PowerShell podem interceptar essas combinações.

Também existem os comandos `/conversas`, `/canais`, `/perfis`, `/config`,
`/ajuda` e `/sair`.

## 👥 Perfis e amizades

No desktop, abra **Perfis** para editar seu nome de exibição, avatar em emoji,
bio, atividade e presença. Os cartões permitem adicionar, aceitar, recusar,
remover, bloquear e desbloquear usuários. Os botões **Mensagem** e **Chamar**
abrem o contato diretamente.

Na CLI, selecione um perfil e use:

| Tecla | Ação contextual                              |
| ----- | -------------------------------------------- |
| `A`   | Adiciona ou aceita uma solicitação           |
| `R`   | Recusa, cancela ou remove uma amizade        |
| `B`   | Bloqueia ou desbloqueia o usuário            |
| `M`   | Abre a conversa direta                       |
| `F4`  | Inicia ou encerra a chamada com esse usuário |

Perfis, amizades e bloqueios são persistidos tanto no armazenamento local
quanto no PostgreSQL e sincronizados em tempo real entre CLI e desktop.

## 🔤 Acentos e símbolos

O compositor trabalha em UTF-8 e preserva acentos, `ç`, `?`, `@`, símbolos,
combinações de `AltGr` e emojis. Colagens com várias linhas são normalizadas sem
quebrar limites Unicode.

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

O áudio usa blocos PCM `f32`, reamostragem no cliente e controle de fluxo no
servidor. Salas de canal exigem associação ao canal; salas diretas aceitam
somente os dois usuários que formam o identificador da sala.

Para produção pública ou grupos muito grandes, a evolução recomendada é trocar o
transporte PCM pelo LiveKit já previsto nas dependências do servidor, mantendo
os mesmos eventos de sala.

## 🧱 Arquitetura

```text
backend/protocol     Schemas Zod e eventos v2 compartilhados
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
npm run bundle:desktop
```
