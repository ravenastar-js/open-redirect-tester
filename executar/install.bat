@echo off
chcp 65001 >nul
title Instalador de Dependências

:: Configura cor do terminal (0 = fundo preto, A = texto verde)
color 0A

:: Navega para a pasta raiz do projeto (um nível acima da pasta "executar")
cd /d "%~dp0..\"

echo.
echo Instalando dependências do projeto...
echo Este processo pode levar alguns minutos...
echo.

:: Verifica se o Node.js está instalado
where node >nul 2>&1 || (
    color 0C & echo [ERRO] Node.js não encontrado
    echo Por favor, instale o Node.js antes de continuar.
    echo Download: https://nodejs.org/
    color 0A & pause
    exit /b 1
)

:: Verifica se o npm está instalado
where npm >nul 2>&1 || (
    color 0C & echo [ERRO] npm não encontrado
    echo O npm deveria vir com o Node.js. Verifique sua instalação.
    color 0A & pause
    exit /b 1
)

:: Executa a instalação com saída no terminal
echo Executando npm install...
echo.

call npm install
set "NPM_EXIT_CODE=%errorlevel%"

:: Verifica o resultado da instalação (mantendo cor verde)
if %NPM_EXIT_CODE% equ 0 (
    color 0A & echo.
    echo Instalação concluída com sucesso!
    echo.
) else (
    color 0C & echo.
    echo [ERRO] Ocorreu um problema durante a instalação
    color 0A & echo.
)

:: Mantém verde até o final
color 0A
pause

:: Restaura cor original do prompt antes de sair
color
exit /b %NPM_EXIT_CODE%