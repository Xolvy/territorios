# 🚀 Force Azure SWA Deployment Script
# Este script fuerza un nuevo deployment limpio

Write-Host "🔥 DEPLOYMENT FORZADO - Azure Static Web Apps" -ForegroundColor Red
Write-Host "Creando deployment limpio..." -ForegroundColor Yellow

# 1. Limpiar cache de Git y GitHub Actions
Write-Host "`n🧹 Limpiando cache..." -ForegroundColor Cyan
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 2. Crear commit vacío para forzar deployment
Write-Host "`n📦 Creando commit de deployment forzado..." -ForegroundColor Cyan
git commit --allow-empty -m "🚀 FORCE DEPLOYMENT: Clean build $(Get-Date -Format 'yyyy-MM-dd-HH:mm')"

# 3. Push con force
Write-Host "`n📤 Enviando deployment forzado..." -ForegroundColor Cyan
git push origin main --force-with-lease

# 4. Monitorear deployment
Write-Host "`n🔍 URLs para monitorear:" -ForegroundColor Yellow
Write-Host "   📊 GitHub Actions: https://github.com/Xolvy/conductores/actions" -ForegroundColor Blue
Write-Host "   🌐 App URL: https://lively-hill-009fd0b0f.2.azurestaticapps.net" -ForegroundColor Blue
Write-Host "   🔧 Azure Portal: https://portal.azure.com" -ForegroundColor Blue

# 5. Verificación automática
Write-Host "`n⏳ Esperando 30 segundos antes de verificar..." -ForegroundColor Green
Start-Sleep 30

Write-Host "`n🎯 Verificando deployment..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://lively-hill-009fd0b0f.2.azurestaticapps.net" -TimeoutSec 10
    if ($response.StatusCode -eq 200 -and $response.Content -match "App Conductores") {
        Write-Host "✅ ¡DEPLOYMENT EXITOSO! La aplicación está funcionando." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Deployment en progreso... La página aún muestra placeholder." -ForegroundColor Yellow
        Write-Host "   Espera 2-3 minutos más y verifica manualmente." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ No se pudo verificar automáticamente. Verifica manualmente en:" -ForegroundColor Yellow
    Write-Host "   https://lively-hill-009fd0b0f.2.azurestaticapps.net" -ForegroundColor Blue
}

Write-Host "`n🎉 Script completado. ¡Verifica tu aplicación!" -ForegroundColor Green