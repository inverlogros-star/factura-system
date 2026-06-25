@echo off
title PACARDYL - Iniciando servidor con PM2...
set PATH=%PATH%;C:\Program Files\nodejs;C:\Users\SPalacio\AppData\Roaming\npm
cd "C:\Users\SPalacio\Documents\PROYECTO PCARDYL\factura-system"

REM Verificar si ya está corriendo
pm2 describe PACARDYL-Servidor >nul 2>&1
if %errorlevel% == 0 (
    echo Servidor ya activo. Reiniciando...
    pm2 restart PACARDYL-Servidor
) else (
    echo Iniciando servidor por primera vez...
    pm2 start scripts\servidor-local.js --name "PACARDYL-Servidor" --restart-delay 3000
    pm2 save
)

echo.
echo ============================================
echo  PACARDYL Servidor corriendo en puerto 3002
echo  PM2 lo mantiene activo automaticamente
echo ============================================
timeout /t 3
