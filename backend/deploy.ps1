# deploy.ps1 - Build, push, and deploy the backend to Cloud Run
# Usage: .\deploy.ps1 [-Tag <tag>]
param(
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

$Project  = "nus-fyp-476103"
$Region   = "us-central1"
$Repo     = "cloud-run-source-deploy"
$Image    = "fyp-backend"
$Service  = "fluency-backend"

$FullImage = "$Region-docker.pkg.dev/$Project/$Repo/${Image}:$Tag"

Write-Host "==> Building image: $FullImage" -ForegroundColor Cyan
docker build --platform linux/amd64 -t $FullImage .
if ($LASTEXITCODE -ne 0) { Write-Error "Docker build failed"; exit 1 }

Write-Host "==> Pushing image to Artifact Registry..." -ForegroundColor Cyan
docker push $FullImage
if ($LASTEXITCODE -ne 0) { Write-Error "Docker push failed"; exit 1 }

Write-Host "==> Deploying to Cloud Run service '$Service'..." -ForegroundColor Cyan
gcloud run deploy $Service `
    --image $FullImage `
    --region $Region `
    --project $Project
if ($LASTEXITCODE -ne 0) { Write-Error "Cloud Run deployment failed"; exit 1 }

Write-Host "==> Done! Service URL:" -ForegroundColor Green
gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)"
