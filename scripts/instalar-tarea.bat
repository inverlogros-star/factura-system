@echo off
echo Instalando tarea programada PACARDYL - Descarga de Facturas...

schtasks /create /tn "PACARDYL_DescargarFacturas" /tr "\"C:\Program Files\nodejs\node.exe\" \"C:\Users\SPalacio\Documents\PROYECTO PCARDYL\factura-system\scripts\descargar-facturas.js\"" /sc minute /mo 60 /st 00:00 /ru "%USERNAME%" /f

if %errorlevel% == 0 (
    echo.
    echo TAREA CREADA EXITOSAMENTE
    echo Se ejecutara cada 60 minutos automaticamente.
    echo.
    echo Ejecutando primera descarga ahora...
    "C:\Program Files\nodejs\node.exe" "C:\Users\SPalacio\Documents\PROYECTO PCARDYL\factura-system\scripts\descargar-facturas.js"
) else (
    echo ERROR al crear la tarea. Intenta ejecutar este archivo como Administrador.
)

pause
