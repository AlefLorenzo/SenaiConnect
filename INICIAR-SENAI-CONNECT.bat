@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Dev.ps1"

if errorlevel 1 (
    echo.
    echo O SENAI Connect nao iniciou. Leia a mensagem acima e corrija a configuracao indicada.
    pause
)

endlocal
