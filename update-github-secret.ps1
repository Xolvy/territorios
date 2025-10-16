#!/usr/bin/env pwsh

# Script para actualizar el GitHub Secret con el token correcto de Azure SWA
# Este script usa GitHub CLI para actualizar el secret automáticamente

Write-Host "🔑 Actualizando GitHub Secret para Azure Static Web Apps..." -ForegroundColor Cyan

# Token de deployment que sabemos que funciona
$deploymentToken = "2efdccdc85c07cfce7a96f6a90b6fabb6241df9adf99b1b7fee6a2892bac12e602-5e6a212e-5866-4804-96f6-6c4ff0ada57400f2313009fd0b0f"

try {
    # Verificar si GitHub CLI está instalado
    $ghVersion = gh --version
    Write-Host "✅ GitHub CLI encontrado: $($ghVersion[0])" -ForegroundColor Green
    
    # Verificar autenticación
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ No estás autenticado con GitHub CLI" -ForegroundColor Red
        Write-Host "Ejecuta: gh auth login" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ Autenticado con GitHub CLI" -ForegroundColor Green
    
    # Actualizar el secret
    Write-Host "🔄 Actualizando secret AZURE_STATIC_WEB_APPS_API_TOKEN_LIVELY_HILL_009FD0B0F..." -ForegroundColor Cyan
    
    $result = gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_LIVELY_HILL_009FD0B0F --body $deploymentToken
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret actualizado exitosamente!" -ForegroundColor Green
        
        # Verificar que el secret existe
        $secrets = gh secret list
        Write-Host "📋 Secrets actuales:" -ForegroundColor Cyan
        Write-Host $secrets
        
        Write-Host "🚀 Ahora puedes hacer push para probar el workflow automático" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al actualizar el secret" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Asegúrate de que GitHub CLI esté instalado y configurado" -ForegroundColor Yellow
    Write-Host "   Instalar: winget install GitHub.cli" -ForegroundColor Yellow
    Write-Host "   Autenticar: gh auth login" -ForegroundColor Yellow
}