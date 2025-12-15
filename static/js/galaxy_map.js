const canvas = document.getElementById('galaxy-canvas');
const ctx = canvas.getContext('2d');
const infoBox = document.getElementById('planet-info');
// Add these to track state locally in the map
let currentSystemName = "Sol";
let targetSystemName = null;

// Helper to find system object by name string
function getSystemByName(name) {
    return systems.find(s => s.name === name);
}
// Resize canvas to fit the container
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawMap();
}
window.addEventListener('resize', resizeCanvas);

// --- DATA: The Systems ---
// In a real app, pass this from Python using Jinja2 or an API
const systems = [
    { id: 1, name: "Sol", x: 0.5, y: 0.5, color: "#ffff00", desc: "Home of the United Earth Government. heavily fortified." },
    { id: 2, name: "Alpha Centauri", x: 0.6, y: 0.45, color: "#00f0ff", desc: "Major trade hub. Terra Nova colony." },
    { id: 3, name: "Wolf 359", x: 0.45, y: 0.55, color: "#ff0000", desc: "Site of the tragic battle. Debris field hazard." },
    { id: 4, name: "Sirius", x: 0.55, y: 0.6, color: "#ffffff", desc: "Mining operations. High pirate activity." },
    { id: 5, name: "Arcturus", x: 0.3, y: 0.3, color: "#ff9900", desc: "Gateway to the traverse. Mass Relay Station." }
];

// Connections (Hyperlanes)
const lanes = [
    [0, 1], [0, 2], [1, 3], [2, 4] // Indices in the systems array
];

// --- MAIN DRAW FUNCTION ---
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    // 1. Draw Static Hyperlanes (The background web)
    ctx.strokeStyle = "rgba(0, 240, 255, 0.1)"; // Faint blue
    ctx.setLineDash([]); // Solid line
    ctx.lineWidth = 1;
    lanes.forEach(lane => {
        const start = systems[lane[0]];
        const end = systems[lane[1]];
        ctx.beginPath();
        ctx.moveTo(start.x * w, start.y * h);
        ctx.lineTo(end.x * w, end.y * h);
        ctx.stroke();
    });

    // 2. Draw "Proposed Route" (If a target is set)
    if (targetSystemName && currentSystemName) {
        const start = getSystemByName(currentSystemName);
        const end = getSystemByName(targetSystemName);

        if (start && end) {
            ctx.strokeStyle = "#ff9900"; // Orange route
            ctx.setLineDash([10, 10]);     // Dashed line
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(start.x * w, start.y * h);
            ctx.lineTo(end.x * w, end.y * h);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash
        }
    }

    // 3. Draw Systems
    systems.forEach(sys => {
        const cx = sys.x * w;
        const cy = sys.y * h;

        // Visual distinction for Current vs Target vs Normal
        if (sys.name === currentSystemName) {
            ctx.fillStyle = "#00ff00"; // Green for HERE
            ctx.shadowColor = "#00ff00";
            ctx.shadowBlur = 20;
        } else if (sys.name === targetSystemName) {
            ctx.fillStyle = "#ff9900"; // Orange for TARGET
            ctx.shadowColor = "#ff9900";
            ctx.shadowBlur = 20;
        } else {
            ctx.fillStyle = sys.color;
            ctx.shadowColor = sys.color;
            ctx.shadowBlur = 10;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px monospace";
        ctx.fillText(sys.name, cx + 12, cy + 4);
    });
}

// --- NEW EXTERNAL FUNCTION ---
// Called by main.html when socket data arrives
function updateMapState(current, target) {
    currentSystemName = current;
    targetSystemName = target;
    drawMap();
}

// --- INTERACTION ---
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const w = canvas.width;
    const h = canvas.height;

    let clickedSystem = null;

    // Check distance to each system
    systems.forEach(sys => {
        const sysX = sys.x * w;
        const sysY = sys.y * h;
        // Simple distance formula
        const dist = Math.sqrt((mouseX - sysX)**2 + (mouseY - sysY)**2);

        if (dist < 20) { // 20px click radius
            clickedSystem = sys;
        }
    });

    if (clickedSystem) {
        showInfo(clickedSystem);
    } else {
        hideInfo();
    }
});

function showInfo(sys) {
    infoBox.style.display = "block";
    infoBox.innerHTML = `
        <h2>${sys.name.toUpperCase()}</h2>
        <p>${sys.desc}</p>
        <small>Coords: ${sys.x}, ${sys.y}</small>
    `;

    // Optional: Draw a "Selection" circle around the clicked star
    drawMap(); // Redraw to clear old selection
    const w = canvas.width;
    const h = canvas.height;
    ctx.strokeStyle = "#ff9900";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sys.x * w, sys.y * h, 12, 0, Math.PI * 2);
    ctx.stroke();
}

function hideInfo() {
    infoBox.style.display = "none";
    drawMap(); // Clear selection ring
}

// Initial draw
resizeCanvas();
