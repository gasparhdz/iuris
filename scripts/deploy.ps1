# Deploy de iuris al VPS (lex-vps).
# Uso:  powershell -File scripts\deploy.ps1            (deploy completo)
#       powershell -File scripts\deploy.ps1 -SoloFrontend
#       powershell -File scripts\deploy.ps1 -SoloBackend
# Requiere: alias SSH "lex-vps" configurado, y el codigo ya pusheado a main
# (el VPS hace git pull para scripts/migraciones; los builds van por scp).
param(
  [switch]$SoloFrontend,
  [switch]$SoloBackend
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$vps = "lex-vps"
$remote = "/var/www/iuris"

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# 1. Actualizar codigo en el VPS (scripts, migraciones, package.json)
Write-Host "==> git pull en el VPS" -ForegroundColor Cyan
ssh $vps "cd $remote; sudo -u iuris git pull --ff-only"
if ($LASTEXITCODE -ne 0) { Fail "git pull en el VPS" }

if (-not $SoloFrontend) {
  Write-Host "==> Build backend (local)" -ForegroundColor Cyan
  Push-Location "$repo\backend"
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "build del backend" }
  Pop-Location

  Write-Host "==> Subir dist del backend" -ForegroundColor Cyan
  ssh $vps "rm -rf $remote/backend/dist.new"
  scp -r -q "$repo\backend\dist" "${vps}:$remote/backend/dist.new"
  if ($LASTEXITCODE -ne 0) { Fail "scp del backend" }
  ssh $vps "rm -rf $remote/backend/dist; mv $remote/backend/dist.new $remote/backend/dist; chown -R iuris:iuris $remote/backend/dist"

  Write-Host "==> npm install + migraciones en el VPS" -ForegroundColor Cyan
  ssh $vps "cd $remote/backend; sudo -u iuris npm install --no-audit --no-fund; sudo -u iuris node scripts/apply-pending-migrations.cjs"
  if ($LASTEXITCODE -ne 0) { Fail "npm install / migraciones" }

  Write-Host "==> Reiniciar servicio" -ForegroundColor Cyan
  ssh $vps "systemctl restart iuris-backend; sleep 3; systemctl is-active iuris-backend"
  if ($LASTEXITCODE -ne 0) { Fail "el servicio no quedo activo (ver: ssh $vps journalctl -u iuris-backend -n 50)" }
}

if (-not $SoloBackend) {
  Write-Host "==> Build frontend (local)" -ForegroundColor Cyan
  Push-Location "$repo\frontend"
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "build del frontend" }
  Pop-Location

  Write-Host "==> Subir dist del frontend" -ForegroundColor Cyan
  ssh $vps "rm -rf $remote/frontend/dist.new"
  scp -r -q "$repo\frontend\dist" "${vps}:$remote/frontend/dist.new"
  if ($LASTEXITCODE -ne 0) { Fail "scp del frontend" }
  ssh $vps "rm -rf $remote/frontend/dist; mv $remote/frontend/dist.new $remote/frontend/dist; chown -R iuris:iuris $remote/frontend/dist; chmod -R a+rX $remote/frontend/dist"
}

# Verificacion final
Write-Host "==> Verificacion" -ForegroundColor Cyan
ssh $vps "curl -s -o /dev/null -w 'API: %{http_code}\n' http://localhost:3000/api/v1/auth/login; curl -s -o /dev/null -w 'Front: %{http_code}\n' -H 'Host: iurispro.com.ar' http://localhost/"
Write-Host "Deploy OK" -ForegroundColor Green
