This folder contains Docker start/stop scripts for each platform:

- macOS: `start-mac.sh`, `stop-mac.sh`
- Linux: `start-linux.sh`, `stop-linux.sh`
- Windows (PowerShell): `start-windows.ps1`, `stop-windows.ps1`

All scripts target the same Docker image/container names:

- Image: `pm-mvp`
- Container: `pm-mvp-app`
- URL: `http://localhost:8000`

Start scripts load environment variables from root `.env` when present by passing `--env-file .env` to `docker run`.