@echo off
setlocal
cd /d "%~dp0"
title DBZ Survivor Local Server
py launch_game.py
if errorlevel 1 python launch_game.py
pause
