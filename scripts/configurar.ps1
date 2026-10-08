# Prepara el proyecto en un PC nuevo (Windows):
#   - crea .env (raiz) con una clave aleatoria para Postgres
#   - crea backend/.env (modo desarrollo) con los mismos datos
# No sobrescribe archivos que ya existan.
# Uso, desde la raiz del proyecto:
#   powershell -ExecutionPolicy Bypass -File scripts\configurar.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$envRaiz = Join-Path $raiz '.env'
$envBackend = Join-Path $raiz 'backend\.env'

# Escribe UTF-8 sin BOM (docker compose no acepta el BOM que agrega PowerShell 5)
function Guardar($ruta, $lineas) { [System.IO.File]::WriteAllLines($ruta, [string[]]$lineas) }

function Valor($nombre, $predeterminado) {
  $linea = Get-Content $envRaiz -Encoding UTF8 | Where-Object { $_ -match "^$nombre=" } | Select-Object -Last 1
  if ($linea) { $v = ($linea -split '=', 2)[1].Trim() } else { $v = '' }
  if ($v) { return $v } else { return $predeterminado }
}

if (Test-Path $envRaiz) {
  Write-Host '.env ya existe: se mantiene'
} else {
  $caracteres = [char[]]'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  $clave = -join (1..24 | ForEach-Object { $caracteres | Get-Random })
  $lineas = Get-Content (Join-Path $raiz '.env.example') -Encoding UTF8 |
    ForEach-Object { $_ -replace '^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$clave" }
  Guardar $envRaiz $lineas
  Write-Host 'Creado .env con una clave aleatoria'
}

$usuario = Valor 'POSTGRES_USER' 'minutas'
$clave = Valor 'POSTGRES_PASSWORD' ''
$base = Valor 'POSTGRES_DB' 'minutas'
$puerto = Valor 'POSTGRES_PORT' '5432'

if (Test-Path $envBackend) {
  Write-Host 'backend/.env ya existe: se mantiene (revisa que DATABASE_URL use la misma clave)'
} else {
  $url = "postgres://${usuario}:${clave}@localhost:${puerto}/${base}"
  $lineas = Get-Content (Join-Path $raiz 'backend\.env.example') -Encoding UTF8 |
    ForEach-Object { $_ -replace '^DATABASE_URL=.*', "DATABASE_URL=$url" }
  Guardar $envBackend $lineas
  Write-Host 'Creado backend/.env'
}

Write-Host 'Listo. Ahora ejecuta: docker compose up --build -d'
