@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Python environment not found. Run the setup steps in README.md first.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" tools\can_dashboard.py
if errorlevel 1 pause
