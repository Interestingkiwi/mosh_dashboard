import sys
import os
import json
import socket
import qrcode
import io
import base64
import webbrowser
from threading import Timer
from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit

# --- RESOURCE PATH HELPER ---
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

app = Flask(__name__,
            template_folder=resource_path('templates'),
            static_folder=resource_path('static'))
app.config['SECRET_KEY'] = 'mass_effect_relay_alpha'
socketio = SocketIO(app, async_mode='threading')

# --- PERSISTENCE MANAGERS ---
SAVE_FILE = 'save.json'

def load_game():
    """Loads state from JSON. Creates default if missing."""
    if not os.path.exists(SAVE_FILE):
        return {
            "status": {"current_system": "Sol", "current_location": "Earth", "hull": 100, "shields": 100, "fuel": 100},
            "unlocks": {"systems": ["Sol"], "locations": ["Earth"], "upgrades": [], "crew": []},
            "library": {"systems": ["Sol"], "locations": ["Earth"], "upgrades": [], "crew": []},
            "inventory": []
        }
    with open(SAVE_FILE, 'r') as f:
        return json.load(f)

def save_game(state):
    """Writes state to JSON."""
    with open(SAVE_FILE, 'w') as f:
        json.dump(state, f, indent=4)

# Load state on startup
game_state = load_game()

# --- HELPER: LOCAL IP ---
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# --- ROUTES ---

@app.route('/')
def player_lobby():
    return render_template('index.html', players=game_state.get('players', []))

@app.route('/dashboard/<player_name>')
def player_dashboard(player_name):
    # Find the specific player object
    player = next((p for p in game_state.get('players', []) if p['name'] == player_name), None)

    # Pass all data needed for Modals (Inventory, Recipes) + Player Stats
    return render_template('player_menu.html',
                           player=player,
                           inventory=game_state.get('inventory', []),
                           recipes=game_state.get('recipes', []))

@app.route('/host')
def host_screen():
    local_ip = get_local_ip()
    port = 5000
    url = f"http://{local_ip}:{port}"
    img = qrcode.make(url)
    data = io.BytesIO()
    img.save(data, "PNG")
    encoded_img = base64.b64encode(data.getvalue()).decode('utf-8')
    return render_template('host_title.html', qr_data=encoded_img, url=url)

@app.route('/main')
def main_dashboard():
    # Now passing 'recipes' as well
    return render_template('main.html',
                           state=game_state['status'],
                           unlocks=game_state['unlocks'],
                           inventory=game_state.get('inventory', []),
                           recipes=game_state.get('recipes', []))

@app.route('/station/<role>')
def station_controls(role):
    # Pass the full state so Pilot sees available systems
    return render_template('controls.html', role=role.capitalize(), state=game_state['status'], unlocks=game_state['unlocks'])

# --- NEW: GM DASHBOARD ---
@app.route('/gm', methods=['GET', 'POST'])
def gm_dashboard():
    global game_state
    if request.method == 'POST':
        # Update Status (Dropdowns/Inputs)
        game_state['status']['current_system'] = request.form.get('current_system')
        game_state['status']['current_location'] = request.form.get('current_location')
        game_state['status']['hull'] = int(request.form.get('hull'))
        game_state['status']['shields'] = int(request.form.get('shields'))
        game_state['status']['fuel'] = int(request.form.get('fuel'))

        # Update Unlocks (Checkboxes)
        # We clear the lists and rebuild them based on what was checked
        game_state['unlocks']['systems'] = request.form.getlist('unlock_systems')
        game_state['unlocks']['locations'] = request.form.getlist('unlock_locations')
        game_state['unlocks']['upgrades'] = request.form.getlist('unlock_upgrades')
        game_state['unlocks']['crew'] = request.form.getlist('unlock_crew')

        save_game(game_state)

        # Push update to all clients immediately
        socketio.emit('update_state', game_state['status'])
        return redirect(url_for('gm_dashboard'))

    return render_template('gamemaster.html', game=game_state)

# --- SOCKET EVENTS ---
@socketio.on('connect')
def handle_connect():
    emit('update_state', game_state['status'])

@socketio.on('plot_course')
def handle_plot(data):
    # Just visuals, doesn't change save file
    socketio.emit('update_state', {'target_system': data.get('target_system')}, broadcast=True)

@socketio.on('engage_jump')
def handle_jump():
    # Only Pilot can trigger this via socket, or GM via dashboard
    # For now, let's keep movement simple
    pass

# --- LAUNCHER ---
def open_browser():
    # CHANGED: Open the public Host Screen, not the GM secret screen
    webbrowser.open_new('http://localhost:5000/host')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    socketio.run(app, host='0.0.0.0', port=5000)
