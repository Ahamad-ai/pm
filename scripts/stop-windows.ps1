$ErrorActionPreference = "Stop"

$ContainerName = "pm-mvp-app"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required but was not found."
}

$Exists = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"
if ($Exists) {
  Write-Host "Stopping and removing container: $ContainerName"
  docker rm -f $ContainerName | Out-Null
  Write-Host "Stopped."
} else {
  Write-Host "Container not found: $ContainerName"
}
