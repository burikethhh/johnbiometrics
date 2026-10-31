@echo off
title Stop FingerGate
color 0C
echo [INFO] Stopping FingerGate background processes...

taskkill /F /FI "WINDOWTITLE eq FingerGate Server*" /T >nul 2>nul
taskkill /F /IM node.exe /FI "MEMUSAGE gt 15000" >nul 2>nul

echo [INFO] Server stopped.
pause

