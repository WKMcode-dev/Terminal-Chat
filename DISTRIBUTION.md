# Distribuição do Terminal Chat

## Para os amigos que só querem usar

O pacote recomendado é o instalador:

```text
Terminal-Chat-Desktop-vX.Y.Z-Windows-x64-Setup.exe
```

Ele instala o Terminal Chat no perfil atual do Windows, cria os atalhos e
baixa o WebView2 automaticamente caso o computador ainda não o possua. Não é
necessário instalar Node.js, Rust, banco de dados ou criar `.env`.

Quem prefere executar a interface desktop sem instalação pode baixar:

```text
Terminal-Chat-Desktop-vX.Y.Z-Windows-x64-Portable.exe
```

Esse arquivo não cria atalhos nem instala componentes. Ele funciona diretamente
quando o Microsoft Edge WebView2 já está presente; caso contrário, utilize o
Setup recomendado acima.

Quem prefere usar o terminal pode baixar o pacote portátil:

```text
Terminal-Chat-CLI-vX.Y.Z-Windows-x64.zip
```

Basta extrair o ZIP e executar `Terminal-Chat.exe`. O servidor oficial já está
configurado nos dois aplicativos:

```text
https://terminal-chat-6pet.onrender.com
```

Requisitos de uso:

- Windows 10 ou 11 de 64 bits;
- acesso à internet;
- microfone e fones de ouvido apenas para chamadas de voz.

O plano gratuito do Render pode colocar o servidor para dormir. O primeiro
login depois de um período sem uso pode levar aproximadamente um minuto; os
clientes aguardam e tentam se reconectar.

## Aviso do Windows em builds sem assinatura

Enquanto o projeto não possuir um certificado de assinatura de código, o
Windows SmartScreen pode exibir **O Windows protegeu o computador**. Confira se
o arquivo veio da página oficial de Releases e compare seu SHA-256 com
`SHA256SUMS.txt` antes de escolher **Mais informações → Executar assim mesmo**.

O Controle Inteligente de Aplicativos do Windows não possui exceção individual.
Em computadores onde ele esteja aplicando bloqueios estritos, a solução correta
é distribuir uma versão assinada digitalmente. Nunca peça que um amigo desative
o antivírus ou outras proteções apenas para instalar o Terminal Chat.

## Gerar os pacotes no Windows

No computador de desenvolvimento, instale Node.js 22, Rust pelo `rustup`,
Microsoft C++ Build Tools e WebView2. Na raiz do projeto, execute:

```powershell
npm run release:windows
```

O processo faz instalação limpa, valida versões e URLs, audita dependências de
produção, executa testes e typechecks, compila a CLI em release, gera o
instalador NSIS, copia o executável portátil do desktop e calcula os hashes
SHA-256. Os arquivos finais ficam em:

```text
artifacts\windows\vX.Y.Z
```

O primeiro build desktop também gera
`frontend\desktop\src-tauri\Cargo.lock`. Inclua esse arquivo no commit seguinte
para que as versões Rust usadas em builds futuros permaneçam fixadas.

## Gerar pela nuvem no GitHub

O workflow **Windows Release** também compila em um Windows oficial do GitHub:

1. em **Actions → Windows Release**, use **Run workflow** para um teste;
2. baixe os artifacts gerados e teste o instalador, o desktop portátil e a CLI;
3. quando estiver aprovado, publique uma tag com a mesma versão do projeto:

```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
```

O workflow cria a Release e anexa o instalador desktop, o executável portátil
do desktop, o ZIP portátil da CLI e o arquivo de hashes.

Na atualização 2.4.0, publique primeiro o servidor e só depois distribua os
novos clientes. O servidor v3 aceita clientes 2.3.2 durante a transição; os
clientes novos também recuam para o codec antigo ao encontrar um servidor v2.
As migrações do Neon são automáticas, não apagam histórico e não armazenam
áudio.

## Antes de enviar aos amigos

- instale em um usuário do Windows que nunca teve o projeto;
- entre com uma conta existente do Neon;
- crie uma segunda conta e confirme que ela só aparece em conversas depois da
  amizade ser aceita;
- teste envio, edição, exclusão, fechamento e reabertura de conversa;
- remova a amizade e confirme que a conversa desaparece para os dois lados;
- teste microfone, retorno local e chamada entre dois computadores;
- abra também o desktop portátil em um computador que já possua WebView2;
- confirme que a tela de login mostra `terminal-chat-6pet.onrender.com`;
- compare os hashes dos arquivos publicados.
