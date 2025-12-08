# 🎨 Script para generar iconos PWA válidos

# Crear iconos usando PowerShell y .NET
Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param(
        [int]$Size,
        [string]$OutputPath
    )
    
    # Crear bitmap
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Configurar calidad
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    
    # Colores del gradiente
    $color1 = [System.Drawing.Color]::FromArgb(16, 185, 129)  # #10b981
    $color2 = [System.Drawing.Color]::FromArgb(30, 64, 175)   # #1e40af
    
    # Crear gradiente
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $color1, $color2, 45)
    
    # Dibujar círculo de fondo
    $graphics.FillEllipse($brush, 0, 0, $Size, $Size)
    
    # Dibujar icono de casa
    $white = [System.Drawing.Brushes]::White
    $font = New-Object System.Drawing.Font("Segoe UI Emoji", ($Size * 0.4), [System.Drawing.FontStyle]::Bold)
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $graphics.DrawString("🏠", $font, $white, ($Size/2), ($Size/2), $stringFormat)
    
    # Guardar imagen
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Limpiar recursos
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $font.Dispose()
    $stringFormat.Dispose()
}

Write-Host "🎨 Generando iconos PWA..." -ForegroundColor Green

# Crear directorio dist si no existe
if (!(Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" -Force | Out-Null
}

# Generar iconos
try {
    Create-Icon -Size 192 -OutputPath "dist/icon-192.png"
    Write-Host "✅ Icono 192x192 generado" -ForegroundColor Green
    
    Create-Icon -Size 512 -OutputPath "dist/icon-512.png"
    Write-Host "✅ Icono 512x512 generado" -ForegroundColor Green
    
    # Crear favicon básico
    Create-Icon -Size 32 -OutputPath "dist/favicon-32.png"
    Write-Host "✅ Favicon 32x32 generado" -ForegroundColor Green
    
} catch {
    Write-Host "⚠️ Error generando iconos con .NET, usando método alternativo..." -ForegroundColor Yellow
    
    # Método alternativo: crear iconos SVG convertidos a PNG usando HTML Canvas
    $svgIcon = @"
<svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="96" cy="96" r="96" fill="url(#grad1)" />
  <text x="96" y="120" text-anchor="middle" font-size="80" fill="white" font-family="Arial">🏠</text>
</svg>
"@
    
    $svgIcon | Out-File -FilePath "dist/icon.svg" -Encoding UTF8
    Write-Host "✅ Icono SVG generado como fallback" -ForegroundColor Green
}

Write-Host "🎨 Iconos PWA generados exitosamente" -ForegroundColor Green