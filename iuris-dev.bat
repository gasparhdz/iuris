@echo off
REM ------------------------------------------------------------
REM  Iuris - Levantar entorno de desarrollo
REM  Abre Backend y Frontend en dos pestanas de la misma
REM  ventana de Windows Terminal (UTF-8).
REM ------------------------------------------------------------

echo Verificando Redis (Memurai)...
sc query Memurai >nul 2>&1
if %errorlevel%==0 (
    net start Memurai >nul 2>&1
    echo   Memurai en ejecucion.
) else (
    echo   [AVISO] El servicio Memurai no esta instalado. La cola SISFE no funcionara.
    echo   Instala Memurai con el .msi del Escritorio.
)

where wt >nul 2>&1
if %errorlevel%==0 (
    echo Iniciando Backend y Frontend en pestanas de Windows Terminal...
    wt new-tab --title "Iuris - Backend" cmd /k "chcp 65001 >nul && cd /d "%~dp0backend" && npm run dev" ; new-tab --title "Iuris - Frontend" cmd /k "chcp 65001 >nul && cd /d "%~dp0frontend" && npx vite preview --host --port 4174"
) else (
    echo   [AVISO] Windows Terminal ^(wt.exe^) no esta disponible. Abriendo ventanas separadas.
    start "Iuris - Backend" cmd /k "chcp 65001 >nul && cd /d "%~dp0backend" && npm run dev"
    start "Iuris - Frontend" cmd /k "chcp 65001 >nul && cd /d "%~dp0frontend" && npx vite preview --host --port 4174"
)

echo Listo! Accede desde el celular en:
echo http://192.168.100.183:4174/lex/
