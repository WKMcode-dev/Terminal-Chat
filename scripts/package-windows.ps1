param(
  [switch]$SkipInstall,
  [switch]$SkipChecks,
  [switch]$SkipDesktop
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$rootPackage = Get-Content (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$version = $rootPackage.version
$releaseDirectory = Join-Path $projectRoot "artifacts\windows\v$version"

if ($env:OS -ne "Windows_NT") {
  throw "A distribuição Windows deve ser gerada no Windows ou no workflow do GitHub."
}

function Invoke-ReleaseStep {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name falhou com o código $LASTEXITCODE."
  }
}

function Get-PortableSha256 {
  param([string]$Path)

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $bytes = $algorithm.ComputeHash($stream)
    return [System.BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
  }
  finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}

Push-Location $projectRoot
try {
  if (-not $SkipInstall) {
    Invoke-ReleaseStep "Instalação reproduzível das dependências" { npm ci }
  }

  if (-not $SkipChecks) {
    Invoke-ReleaseStep "Validação da configuração de release" { npm run release:check }
    Invoke-ReleaseStep "Auditoria das dependências de produção" { npm run audit:production }
    Invoke-ReleaseStep "Testes automatizados" { npm test }
    Invoke-ReleaseStep "Typecheck TypeScript e Rust" { npm run typecheck }
  }

  Invoke-ReleaseStep "Compilação release da CLI" {
    cargo build --manifest-path frontend/cli/Cargo.toml --release --locked
  }

  if (-not $SkipDesktop) {
    Invoke-ReleaseStep "Instalador NSIS do aplicativo desktop" {
      npm run bundle:desktop -- --bundles nsis
    }

    $desktopLockFile = Join-Path $projectRoot "frontend\desktop\src-tauri\Cargo.lock"
    if (-not (Test-Path -LiteralPath $desktopLockFile)) {
      throw "O build desktop terminou sem gerar $desktopLockFile."
    }
  }

  if (Test-Path -LiteralPath $releaseDirectory) {
    Remove-Item -LiteralPath $releaseDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

  $cliExecutable = Join-Path $projectRoot "frontend\cli\target\release\terminal-chat.exe"
  if (-not (Test-Path -LiteralPath $cliExecutable)) {
    throw "O executável release da CLI não foi encontrado em $cliExecutable."
  }

  $cliFolderName = "Terminal-Chat-CLI-v$version-Windows-x64"
  $cliStagingDirectory = Join-Path $releaseDirectory $cliFolderName
  New-Item -ItemType Directory -Path $cliStagingDirectory -Force | Out-Null
  Copy-Item -LiteralPath $cliExecutable -Destination (Join-Path $cliStagingDirectory "Terminal-Chat.exe")
  Copy-Item -LiteralPath (Join-Path $projectRoot "DISTRIBUTION.md") -Destination $cliStagingDirectory
  Copy-Item -LiteralPath (Join-Path $projectRoot "LICENSE") -Destination $cliStagingDirectory

  $cliArchive = Join-Path $releaseDirectory "$cliFolderName.zip"
  Compress-Archive -Path (Join-Path $cliStagingDirectory "*") -DestinationPath $cliArchive -CompressionLevel Optimal
  Remove-Item -LiteralPath $cliStagingDirectory -Recurse -Force

  if (-not $SkipDesktop) {
    $nsisDirectory = Join-Path $projectRoot "frontend\desktop\src-tauri\target\release\bundle\nsis"
    $installer = Get-ChildItem -LiteralPath $nsisDirectory -Filter "*-setup.exe" -File |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if (-not $installer) {
      throw "O instalador NSIS não foi encontrado em $nsisDirectory."
    }
    $installerName = "Terminal-Chat-Desktop-v$version-Windows-x64-Setup.exe"
    Copy-Item -LiteralPath $installer.FullName -Destination (Join-Path $releaseDirectory $installerName)

    $desktopExecutable = Join-Path $projectRoot "frontend\desktop\src-tauri\target\release\terminal-chat-desktop.exe"
    if (-not (Test-Path -LiteralPath $desktopExecutable)) {
      throw "O executável portátil do desktop não foi encontrado em $desktopExecutable."
    }
    $portableDesktopName = "Terminal-Chat-Desktop-v$version-Windows-x64-Portable.exe"
    Copy-Item -LiteralPath $desktopExecutable -Destination (Join-Path $releaseDirectory $portableDesktopName)
  }

  $hashLines = Get-ChildItem -LiteralPath $releaseDirectory -File |
    Where-Object Name -ne "SHA256SUMS.txt" |
    Sort-Object Name |
    ForEach-Object {
      $hash = Get-PortableSha256 -Path $_.FullName
      "$hash  $($_.Name)"
    }
  Set-Content -LiteralPath (Join-Path $releaseDirectory "SHA256SUMS.txt") -Value $hashLines -Encoding utf8

  Write-Host "`nDistribuição v$version criada em:" -ForegroundColor Green
  Write-Host $releaseDirectory
  Get-ChildItem -LiteralPath $releaseDirectory -File |
    Select-Object Name, Length |
    Format-Table -AutoSize
}
finally {
  Pop-Location
}
