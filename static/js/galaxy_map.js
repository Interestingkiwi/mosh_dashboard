const canvas = document.getElementById('galaxy-canvas');
const ctx = canvas.getContext('2d');
const infoBox = document.getElementById('planet-info');

// --- SETTINGS ---
const SHOW_GRID = true; // Set to false when you are done developing!

// --- VIEWPORT STATE ---
let view = { scale: 1, offsetX: 0, offsetY: 0, isDragging: false, startX: 0, startY: 0 };

// --- DATA LAYER 1: SYSTEMS (Background Circles) ---
const systems = [
    { name: "Unknown Sector", x: 0.15, y: 0.10, radius: 0.08, color: "rgba(255, 255, 0, 0.05)", border: "rgba(255, 255, 0, 0.2)" },
    { name: "Las Pyroeaux Expanse", x: 0.82, y: 0.35, radius: 0.15, color: "rgba(255, 0, 255, 0.05)", border: "rgba(255, 0, 255, 0.2)" },
    { name: "Omega Nonrax Territory", x: 0.3, y: 0.7, radius: 0.21, color: "rgba(255, 50, 50, 0.05)", border: "rgba(255, 50, 50, 0.2)" },
    { name: "Picon Toloid Region", x: 0.48, y: 0.25, radius: 0.12, color: "rgba(255, 0, 255, 0.05)", border: "rgba(255, 0, 255, 0.2)" },
    { name: "The Whimus Territory", x: 0.67, y: 0.78, radius: 0.15, color: "rgba(255, 0, 255, 0.05)", border: "rgba(255, 0, 255, 0.2)" },
    { name: "The Depox Zone", x: 0.92, y: 0.86, radius: 0.10, color: "rgba(255, 0, 255, 0.05)", border: "rgba(255, 0, 255, 0.2)" },
];

// --- DATA LAYER 2: LOCATIONS (Clickable Points) ---
// Note: IDs added for safer linking
const locations = [
    // Unknown Sector
    { id: "temp1", name: "Temp1", x: 0.09, y: 0.10, color: "#00f0ff", desc: "Seat of the United Earth Government." },

    // LAS PYROEAUX EXPANSE
    { id: "gilouria", name: "Gilouria", x: 0.68, y: 0.32, color: "#ff00ff", desc: "Gas giant mining platform." },
    { id: "samsa", name: "Samsa VI", x: 0.75, y: 0.38, color: "#ffffff", desc: "Frozen wasteland. Research outpost." },
    { id: "unknown5", name: "Unknown-LPE", x: 0.87, y: 0.51, color: "#ff9900", desc: "The lawless capital of the Terminus." },

    // OMEGA NONRAX
    { id: "maat", name: "Ma'at", x: 0.28, y: 0.68, color: "#ff3333", desc: "Desert world, once presumed unihabitable, but recent storms uncovered signs of an ancient city" },
    { id: "zerth", name: "Zerth XSHZ", x: 0.35, y: 0.85, color: "#aaaaaa", desc: "Planet designated for waste dumping by various Megacorporations. The New Jersey of the Stars" },
    { id: "temp2", name: "Temp2", x: 0.13, y: 0.65, color: "#ff9900", desc: "The lawless capital of the Terminus." },
    { id: "jump-ont", name: "Jump-ONT", x: 0.35, y: 0.80, color: "#ff9900", desc: "The lawless capital of the Terminus." },
    { id: "unknown1", name: "Unknown-ONT", x: 0.26, y: 0.48, color: "#ff9900", desc: "The lawless capital of the Terminus." },
    { id: "unknown2", name: "Unknown-ONT", x: 0.33, y: 0.91, color: "#ff9900", desc: "The lawless capital of the Terminus." },

    //Picon Toloid Region
    { id: "unknown3", name: "Unknown-PTR", x: 0.41, y: 0.19, color: "#ff9900", desc: "The lawless capital of the Terminus." },

    //The Whimus Territory
    { id: "unknown4", name: "Unknown-TWT", x: 0.71, y: 0.80, color: "#ff9900", desc: "The lawless capital of the Terminus." },

    // The Depox Zone
    { id: "tabernas", name: "Tabernas", x: 0.95, y: 0.89, color: "#ff00ff", desc: "Gas giant." },
    { id: "jump-tdz", name: "Jump-TDZ", x: 0.91, y: 0.87, color: "#ff00ff", desc: "Gas giant." }
];

// --- DATA LAYER 3: HYPERLANES ---
// Uses IDs now, so order doesn't matter!
const lanes = [
    ["earth", "gilouria"],
    ["earth", "maat"],
    ["maat", "omega"],
    ["gilouria", "samsa"]
];

// --- HELPERS ---
function isSystemUnlocked(name) {
    if (!window.unlockedSystems) return false;
    return window.unlockedSystems.includes(name);
}

function isLocationUnlocked(name) {
    if (!window.unlockedLocations) return false;
    return window.unlockedLocations.includes(name);
}

function getLocById(id) {
    return locations.find(loc => loc.id === id);
}

function worldToScreen(wx, wy) {
    return { x: (wx * canvas.width * view.scale) + view.offsetX, y: (wy * canvas.height * view.scale) + view.offsetY };
}

// --- NEW: UPDATE HOOK (Was missing in previous upload) ---
function updateMapState(current, target) {
    // You can add logic here to highlight the current system if you like
    drawMap();
}

// --- GRID DRAWING ---
function drawGrid() {
    ctx.lineWidth = 1;
    ctx.font = "10px monospace";

    // Draw lines every 0.1 (10%)
    for (let i = 0; i <= 1.05; i += 0.1) { // 1.05 buffer to catch the 1.0 line
        const val = Math.round(i * 10) / 10; // Avoid floating point errors like 0.3000004

        // Vertical Lines
        const top = worldToScreen(val, 0);
        const bottom = worldToScreen(val, 1);

        ctx.beginPath();
        ctx.strokeStyle = (val === 0.5) ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.1)"; // Highlight center
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();

        // Horizontal Lines
        const left = worldToScreen(0, val);
        const right = worldToScreen(1, val);

        ctx.beginPath();
        ctx.strokeStyle = (val === 0.5) ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.1)"; // Highlight center
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();

        // Labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        if (val < 1.0) {
            ctx.fillText(val, top.x + 2, top.y + 12); // X-axis labels at top
            ctx.fillText(val, left.x + 2, left.y - 2); // Y-axis labels at left
        }
    }
}

// --- MAIN DRAW FUNCTION ---
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;

    // 0. Draw Grid (Background)
    if (SHOW_GRID) drawGrid();

    // 1. Draw SYSTEMS (Circles)
    systems.forEach(sys => {
        if (isSystemUnlocked(sys.name)) {
            const pos = worldToScreen(sys.x, sys.y);
            const r = sys.radius * w * view.scale;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = sys.color; ctx.fill();
            ctx.lineWidth = 2 * view.scale; ctx.strokeStyle = sys.border; ctx.stroke();

            if (view.scale > 0.4) {
                ctx.fillStyle = sys.border; ctx.font = `bold ${16 * view.scale}px 'Segoe UI', monospace`;
                ctx.textAlign = "center"; ctx.fillText(sys.name.toUpperCase(), pos.x, pos.y - r - (10 * view.scale)); ctx.textAlign = "start";
            }
        }
    });

    // 2. Draw HYPERLANES (ID Linked)
    ctx.strokeStyle = "rgba(0, 240, 255, 0.15)"; ctx.lineWidth = 1 * view.scale;
    lanes.forEach(lane => {
        const s = getLocById(lane[0]);
        const e = getLocById(lane[1]);
        if (s && e && isLocationUnlocked(s.name) && isLocationUnlocked(e.name)) {
            const p1 = worldToScreen(s.x, s.y); const p2 = worldToScreen(e.x, e.y);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
    });

    // 3. Draw LOCATIONS (Points)
    locations.forEach(loc => {
        if (isLocationUnlocked(loc.name)) {
            const pos = worldToScreen(loc.x, loc.y);
            const radius = 5 * view.scale;
            ctx.fillStyle = loc.color; ctx.shadowColor = loc.color; ctx.shadowBlur = 10 * view.scale;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2); ctx.fill();
            if (view.scale > 0.6) {
                ctx.fillStyle = "#ffffff"; ctx.font = `${11 * view.scale}px monospace`;
                ctx.shadowBlur = 0; ctx.fillText(loc.name, pos.x + (10 * view.scale), pos.y + (4 * view.scale));
            }
        }
    });
}

function resizeCanvas() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; drawMap(); }
window.addEventListener('resize', resizeCanvas);

// --- INTERACTION ---
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheel * zoomIntensity);
    const newScale = view.scale * zoomFactor;
    if (newScale < 0.5 || newScale > 10) return;
    view.offsetX = mouseX - (mouseX - view.offsetX) * zoomFactor;
    view.offsetY = mouseY - (mouseY - view.offsetY) * zoomFactor;
    view.scale = newScale;
    drawMap();
});
canvas.addEventListener('mousedown', (e) => { view.isDragging = true; view.startX = e.clientX; view.startY = e.clientY; canvas.style.cursor = "grabbing"; });
canvas.addEventListener('mousemove', (e) => {
    if (view.isDragging) {
        view.offsetX += (e.clientX - view.startX); view.offsetY += (e.clientY - view.startY);
        view.startX = e.clientX; view.startY = e.clientY; drawMap();
    }
});
canvas.addEventListener('mouseup', () => { view.isDragging = false; canvas.style.cursor = "crosshair"; });
canvas.addEventListener('click', (e) => {
    if (Math.abs(e.clientX - view.startX) > 5 || Math.abs(e.clientY - view.startY) > 5) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let clickedLoc = null;
    locations.forEach(loc => {
        if (isLocationUnlocked(loc.name)) {
            const pos = worldToScreen(loc.x, loc.y);
            const dist = Math.sqrt((mouseX - pos.x)**2 + (mouseY - pos.y)**2);
            if (dist < 15 * view.scale) clickedLoc = loc;
        }
    });
    if (clickedLoc) {
        infoBox.style.display = "block";
        infoBox.innerHTML = `<h2>${clickedLoc.name.toUpperCase()}</h2><p>${clickedLoc.desc}</p>`;
    } else { infoBox.style.display = "none"; }
});

resizeCanvas();
