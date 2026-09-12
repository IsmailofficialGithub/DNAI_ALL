# ============================================================================
# Docker Environment Verification Script
# Verifies that environment variables are loaded correctly
# ============================================================================

Write-Host "`n🔍 Docker Environment Verification" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# Check if container is running
Write-Host "📊 Step 1: Checking container status..." -ForegroundColor Yellow
$containerStatus = docker-compose ps --format json | ConvertFrom-Json
if ($containerStatus.State -eq "running") {
    Write-Host "   ✅ Container is running" -ForegroundColor Green
} else {
    Write-Host "   ❌ Container is not running!" -ForegroundColor Red
    Write-Host "   Status: $($containerStatus.State)" -ForegroundColor Red
    exit 1
}

# Check health endpoint
Write-Host "`n🏥 Step 2: Checking health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Health check passed" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)" -ForegroundColor White
    Write-Host "   Environment: $($healthResponse.environment)" -ForegroundColor White
    Write-Host "   Database: $($healthResponse.env.databaseUrl)" -ForegroundColor White
    Write-Host "   Supabase URL: $($healthResponse.env.supabaseUrl)" -ForegroundColor White
    Write-Host "   Supabase Key: $($healthResponse.env.supabaseServiceKey)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Health check failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check logs for environment variable confirmation
Write-Host "`n📋 Step 3: Checking logs for environment variables..." -ForegroundColor Yellow
$logs = docker-compose logs --tail=50
$envChecks = @(
    "All required environment variables are set",
    "Supabase Configuration Debug",
    "Supabase URL:",
    "Backend Server Started Successfully"
)

$allFound = $true
foreach ($check in $envChecks) {
    if ($logs -match $check) {
        Write-Host "   ✅ Found: $check" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing: $check" -ForegroundColor Red
        $allFound = $false
    }
}

# Check for Supabase URL in logs
Write-Host "`n🔗 Step 4: Verifying Supabase configuration..." -ForegroundColor Yellow
$supabaseLogs = docker-compose logs | Select-String "Supabase URL:"
if ($supabaseLogs) {
    Write-Host "   ✅ Supabase URL found in logs" -ForegroundColor Green
    $supabaseLogs | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
} else {
    Write-Host "   ⚠️  Supabase URL not found in logs" -ForegroundColor Yellow
}

# Check for WhatsApp session initialization
Write-Host "`n📱 Step 5: Checking WhatsApp session initialization..." -ForegroundColor Yellow
$whatsappLogs = docker-compose logs | Select-String "BAILEYS|WhatsApp"
if ($whatsappLogs) {
    Write-Host "   ✅ WhatsApp initialization found" -ForegroundColor Green
    $whatsappLogs | Select-Object -Last 3 | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
} else {
    Write-Host "   ⚠️  WhatsApp initialization not found (may still be starting)" -ForegroundColor Yellow
}

# Final summary
Write-Host "`n📊 Verification Summary" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
if ($allFound -and $healthResponse.status -eq "ok") {
    Write-Host "   ✅ All checks passed!" -ForegroundColor Green
    Write-Host "   ✅ Environment variables loaded correctly" -ForegroundColor Green
    Write-Host "   ✅ Container is healthy" -ForegroundColor Green
    Write-Host "`n🎉 Docker configuration is working correctly!`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Some checks failed - review logs" -ForegroundColor Yellow
    Write-Host "   Run: docker-compose logs -f" -ForegroundColor White
    Write-Host "`n"
}

