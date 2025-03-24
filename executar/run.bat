@echo off
chcp 65001 >nul
title Open Redirect Tester

:: Configurações
set "ROOT_DIR=%~dp0..\"  :: Volta um nível para a pasta raiz
set "REPORT_PATH=%ROOT_DIR%src\report.txt"

:: Navega para a pasta raiz do projeto
cd /d "%ROOT_DIR%"

echo Testando vulnerabilidades Open Redirect...
echo Por favor, aguarde...
echo.

:: Verifica dependências
where node >nul 2>&1 || (
    echo [ERRO] Node.js não encontrado
    pause
    exit /b 1
)

where npm >nul 2>&1 || (
    echo [ERRO] npm não encontrado
    pause
    exit /b 1
)

:: Remove relatório anterior se existir
if exist "%REPORT_PATH%" del "%REPORT_PATH%"

:: Executa os testes
call npm start
set "NPM_EXIT_CODE=%errorlevel%"

:: Exibe resultado e abre relatório
echo.
if %NPM_EXIT_CODE% equ 0 (
    echo Teste concluído com sucesso!
) else (
    echo [ERRO] O teste encontrou problemas
)

if exist "%REPORT_PATH%" (
    echo.
    echo Relatório gerado com sucesso!
    echo Abrindo relatório...
    timeout /t 1 >nul
    start "" "%REPORT_PATH%"
) else (
    echo.
    echo Nenhum relatório foi gerado
    echo Verifique as mensagens de erro acima
)

pause
exit /b 0