<#
  把 dsh-memoir 的源码同步到 profile 的安装位置。

  为什么需要它：pnpm 用 `file:` 装本地包时是**硬链接**，用编辑器改写源文件会断开
  链接，安装位置的副本就不再更新。改完源码必须跑一次这个脚本，然后重启客户端。

  用法（在任意位置）：
    & .\scripts\sync.ps1                  # 同步到 desktop
    & .\scripts\sync.ps1 -Profile web     # 同步到 web

  若执行策略挡住了脚本，用：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync.ps1
#>
param([string]$Profile = 'desktop')

$ErrorActionPreference = 'Stop'
$src = Split-Path $PSScriptRoot -Parent
$dst = Join-Path "D:\dsh\profiles\$Profile\node_modules" '@yansera\dsh-memoir'

if (-not (Test-Path $dst)) {
  Write-Host "安装位置不存在：$dst" -ForegroundColor Red
  Write-Host "先装一次：& '<客户端目录>\resources\runtime\cli\bin\dsh.cmd' plugin --profile $Profile add `"file:$src`""
  exit 1
}

$changed = @()

# src/ 下的实现文件（与 package.json 的 files 字段一致）
$srcDir = Join-Path $src 'src'
$dstDir = Join-Path $dst 'src'
if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
foreach ($f in (Get-ChildItem $srcDir -File)) {
  $to = Join-Path $dstDir $f.Name
  if ((Test-Path $to) -and ((Get-FileHash $f.FullName).Hash -eq (Get-FileHash $to).Hash)) { continue }
  Copy-Item $f.FullName $to -Force
  $changed += "src/$($f.Name)"
}

# 根目录的包清单与文档
foreach ($name in @('package.json', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'LICENSE')) {
  $from = Join-Path $src $name
  if (-not (Test-Path $from)) { continue }
  $to = Join-Path $dst $name
  if ((Test-Path $to) -and ((Get-FileHash $from).Hash -eq (Get-FileHash $to).Hash)) { continue }
  Copy-Item $from $to -Force
  $changed += $name
}

# 旧版扁平布局留下的入口文件：新版把它们挪进了 src/，残留会遮住新入口
foreach ($stale in @('index.js', 'distill.js', 'client.js')) {
  $p = Join-Path $dst $stale
  if (Test-Path $p) { Remove-Item $p -Force; $changed += "-$stale(旧布局残留)" }
}

if ($changed.Count -eq 0) {
  Write-Host '已是最新，无需同步。'
} else {
  Write-Host "同步了 $($changed.Count) 项：$($changed -join '、')"
  Write-Host '新代码要**重启客户端**才生效（热加载只在安装插件那一刻发生）。' -ForegroundColor Yellow
}
