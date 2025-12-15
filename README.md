# Mothership OS Dashboard

A local Python-based dashboard for tabletop RPGs (Mothership, Mass Effect, Star Trek). It runs a local web server to sync a Main Display (PC) with Player Consoles (Mobile/Tablet).

## Features
* **Real-time Sync:** WebSockets update all screens instantly.
* **Role-Based Views:** Pilot, Engineer, Gunner, and GM interfaces.
* **GM Override:** Control campaign state via a mobile-friendly dashboard.
* **Interactive Map:** Clickable HTML5 canvas galaxy map.

## How to Run (Dev)
1. Install dependencies: `pip install -r requirements.txt`
2. Run app: `python app.py`

## How to Build (.exe)
1. Run `build.bat`
2. Check `dist/` folder for the executable.
