$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$appPort = 3000
if (Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue) {
    Write-Host 'Port 3000 is already running. Frontend: http://127.0.0.1:3000/  Admin: http://127.0.0.1:3000/admin'
    exit 0
}
if (-not (Test-Path -LiteralPath 'node_modules/vinext/dist/cli.js')) {
    & npm.cmd ci --cache .npm-cache --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
New-Item -ItemType Directory -Path 'local-logs' -Force | Out-Null
$appNode = (Get-Command node.exe).Source
$appProcess = Start-Process -FilePath $appNode -ArgumentList 'node_modules/vinext/dist/cli.js','dev' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/local-logs/server.log" -RedirectStandardError "$PSScriptRoot/local-logs/server-error.log" -PassThru
$appProcess.Id | Set-Content -LiteralPath 'local-logs/server.pid'
 $appReady = $false
for ($appAttempt = 0; $appAttempt -lt 45; $appAttempt++) {
    $appProcess.Refresh()
    if ($appProcess.HasExited) { throw 'Server exited. Check local-logs/server-error.log.' }
    try {
        $appResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
        if ($appResponse.StatusCode -eq 200) { $appReady = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $appReady) { throw 'Server did not become ready. Check local-logs/server-error.log.' }
Write-Host "Started PID $($appProcess.Id). Frontend: http://127.0.0.1:3000/  Admin: http://127.0.0.1:3000/admin"
