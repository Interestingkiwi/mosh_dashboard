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
    if not os.path.exists(SAVE_FILE):
        return {
            "status": {"current_system": "Sol", "current_location": "Earth", "hull": 100, "shields": 100, "fuel": 100},
            "players": [],
            "unlocks": {"systems": ["Sol"], "locations": ["Earth"], "upgrades": [], "crew": []},
            "library": {"systems": ["Sol"], "locations": ["Earth"], "upgrades": [], "crew": []},
            "inventory": [],
            "recipes": []
        }
    with open(SAVE_FILE, 'r') as f:
        data = json.load(f)
        # Ensure new fields exist if loading old save
        if 'mess_offline' not in data['status']: data['status']['mess_offline'] = False
        if 'action_log' not in data: data['action_log'] = []
        return data

def save_game(state):
    with open(SAVE_FILE, 'w') as f:
        json.dump(state, f, indent=4)

game_state = load_game()

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
    player = next((p for p in game_state.get('players', []) if p['name'] == player_name), None)
    return render_template('player_menu.html',
                           player=player,
                           inventory=game_state.get('inventory', []),
                           recipes=game_state.get('recipes', []),
                           state=game_state['status']) # <--- ADDED THIS

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
    return render_template('main.html',
                           state=game_state['status'],
                           unlocks=game_state['unlocks'],
                           inventory=game_state.get('inventory', []),
                           recipes=game_state.get('recipes', []))

@app.route('/station/<role>')
def station_controls(role):
    return render_template('controls.html', role=role.capitalize(), state=game_state['status'], unlocks=game_state['unlocks'])

@app.route('/gm', methods=['GET', 'POST'])
def gm_dashboard():
    global game_state
    if request.method == 'POST':
        game_state['status']['current_system'] = request.form.get('current_system')
        game_state['status']['current_location'] = request.form.get('current_location')
        game_state['status']['hull'] = int(request.form.get('hull'))
        game_state['status']['shields'] = int(request.form.get('shields'))
        game_state['status']['fuel'] = int(request.form.get('fuel'))

        game_state['unlocks']['systems'] = request.form.getlist('unlock_systems')
        game_state['unlocks']['locations'] = request.form.getlist('unlock_locations')
        game_state['unlocks']['upgrades'] = request.form.getlist('unlock_upgrades')
        game_state['unlocks']['crew'] = request.form.getlist('unlock_crew')

        save_game(game_state)
        socketio.emit('update_state', game_state['status'])
        return redirect(url_for('gm_dashboard'))

    return render_template('gamemaster.html', game=game_state)


@app.route('/gm/reset_mess', methods=['POST'])
def gm_reset_mess():
    """GM Only: Re-enables the Mess Hall"""
    game_state['status']['mess_offline'] = False

    # Log the maintenance
    log_entry = {
        "text": "SYSTEM ALERT: Mess Hall maintenance complete. Systems online.",
        "type": "system"
    }
    game_state['action_log'].append(log_entry)

    save_game(game_state)

    # Broadcast to re-enable buttons
    socketio.emit('update_state', game_state['status'])
    socketio.emit('new_log', log_entry)

    return redirect(url_for('gm_dashboard'))


# --- SOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    emit('update_state', game_state['status'])

@socketio.on('complete_cooking')
def handle_cooking(data):
    """
    Consumes ingredients based on recipe requirements.
    Expected data: {'recipe': 'Recipe Name', 'outcome': 'Success'}
    """
    recipe_name = data.get('recipe')
    outcome = data.get('outcome')

    # If they cancelled, do nothing
    if outcome == 'Cancel':
        return

    # Find the recipe
    recipe = next((r for r in game_state.get('recipes', []) if r['name'] == recipe_name), None)
    if not recipe:
        return

    inventory = game_state.get('inventory', [])

    # Process each requirement (e.g., Tier 1, Qty 2)
    for req in recipe['requirements']:
        tier = req['tier']
        qty_needed = req['qty']

        # Find matching items in inventory (Category=Ingredients AND Description contains "Tier X")
        # We sort by quantity ascending to use up small stacks first? Or just any.
        candidates = [i for i in inventory if i.get('category') == 'Ingredients' and f"Tier {tier}" in i.get('description', '')]

        for item in candidates:
            if qty_needed <= 0: break

            take = min(item['qty'], qty_needed)
            item['qty'] -= take
            qty_needed -= take

    # Remove items with 0 quantity
    game_state['inventory'] = [i for i in inventory if i['qty'] > 0]

    save_game(game_state)

    # Broadcast full update (Status + Inventory) so everyone sees the stock drop
    response = game_state['status'].copy()
    response['inventory'] = game_state['inventory']
    emit('update_state', response, broadcast=True)

@socketio.on('plot_course')
def handle_plot(data):
    socketio.emit('update_state', {'target_system': data.get('target_system')}, broadcast=True)

@socketio.on('engage_jump')
def handle_jump():
    pass


@socketio.on('complete_cooking')
def handle_cooking(data):
    """
    1. Update Player Skill
    2. Deduct Ingredients
    3. Generate Log
    4. Disable Mess Hall
    """
    player_name = data.get('player_name')
    recipe_name = data.get('recipe')
    outcome = data.get('outcome')

    if outcome == 'Cancel': return

    # 1. Update Skill
    player = next((p for p in game_state.get('players', []) if p['name'] == player_name), None)
    if player:
        xp_map = {
            'Critical Success': 10,
            'Success': 5,
            'Failure': 2,
            'Critical Failure': -2
        }
        change = xp_map.get(outcome, 0)
        player['skills']['cooking'] = max(0, player['skills']['cooking'] + change)

    # 2. Deduct Ingredients (Existing Logic)
    recipe = next((r for r in game_state.get('recipes', []) if r['name'] == recipe_name), None)
    if recipe:
        inventory = game_state.get('inventory', [])
        for req in recipe['requirements']:
            tier = req['tier']
            qty_needed = req['qty']
            candidates = [i for i in inventory if i.get('category') == 'Ingredients' and f"Tier {tier}" in i.get('description', '')]
            for item in candidates:
                if qty_needed <= 0: break
                take = min(item['qty'], qty_needed)
                item['qty'] -= take
                qty_needed -= take
        game_state['inventory'] = [i for i in inventory if i['qty'] > 0]

    # 3. Generate Log Message
    log_type = "normal"
    effect_text = recipe['effect']

    if outcome == 'Critical Success':
        log_type = "crit-success"
        bonus = recipe.get('critical_success', "Delicious! Morale +1.")
        effect_text += f" CRITICAL BONUS: {bonus}"
    elif outcome == 'Critical Failure':
        log_type = "crit-fail"
        malus = recipe.get('critical_fail', "Burnt! Kitchen Fire started.")
        effect_text += f" CRITICAL FAIL: {malus}"

    log_message = f"{player_name} cooked {recipe_name} ({outcome}). Effect: {effect_text}"

    new_log = {"text": log_message, "type": log_type}
    game_state.get('action_log', []).append(new_log)

    # Keep log short (last 10 items)
    if len(game_state['action_log']) > 10:
        game_state['action_log'].pop(0)

    # 4. Disable Mess Hall Globally
    game_state['status']['mess_offline'] = True

    save_game(game_state)

    # Broadcast EVERYTHING
    response = game_state['status'].copy()
    response['inventory'] = game_state['inventory']

    emit('update_state', response, broadcast=True) # Updates Bars, Buttons, Inventory
    emit('new_log', new_log, broadcast=True)       # Updates Log View


def open_browser():
    webbrowser.open_new('http://localhost:5000/host')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    socketio.run(app, host='0.0.0.0', port=5000)
