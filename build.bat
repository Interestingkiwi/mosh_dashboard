@echo off
echo Building MothershipOS...
call venv\Scripts\activate
pyinstaller --name "MothershipOS" --add-data "templates;templates" --add-data "static;static" --hidden-import "engineio.async_drivers.threading" --hidden-import "simple_websocket" --onefile --clean app.py
echo.
echo Build Complete!
pause
