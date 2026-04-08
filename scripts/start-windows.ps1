$ErrorActionPreference = "Stop"

$ImageName = "pm-mvp"
$ContainerName = "pm-mvp-app"
$Port = "8000"
$EnvFile = ".env"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required but was not found."
}

Write-Host "Building Docker image: $ImageName"
docker build -t $ImageName .

Write-Host "Removing existing container if present: $ContainerName"
$Exists = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"
if ($Exists) {
  docker rm -f $ContainerName | Out-Null
}

Write-Host "Starting container on http://localhost:$Port"
if (Test-Path $EnvFile) {
  docker run -d --name $ContainerName --env-file $EnvFile -p "$Port`:8000" $ImageName | Out-Null
} else {
  docker run -d --name $ContainerName -p "$Port`:8000" $ImageName | Out-Null
}

Write-Host "Done. Open http://localhost:$Port"
