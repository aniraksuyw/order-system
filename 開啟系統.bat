@echo off
cd /d "%~dp0"
"C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8080 --bind 127.0.0.1
