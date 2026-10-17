@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul && (python serve.py & goto :eof)
where py >nul 2>nul && (py serve.py & goto :eof)
echo Python was not found. Install Python 3 from https://www.python.org/downloads/ and run this file again.
pause
