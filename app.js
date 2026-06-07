// Main Application Driver for Spinner Wheels Reborn (with Multi-Wheel Grid, Teams, and Quick Fill)
import { playTick, playWinner, setMasterVolume } from './audio.js';
import { startConfetti, stopConfetti } from './confetti.js';
import { decompressFromHash, generateShareUrl } from './sharing.js';

// Color Palette Presets
const PALETTES = {
    rainbow: ['#ef4444', '#1d4ed8', '#facc15', '#7c3aed', '#f97316', '#16a34a', '#db2777', '#0d9488'],
    pastel: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e8c4ec', '#f3d1f4'],
    neon: ['#39ff14', '#fe019a', '#04d9ff', '#bc34fa', '#ff073a', '#ffff00'],
    sunset: ['#f857a6', '#ff5858', '#ffa07a', '#ff7f50', '#ff6b6b', '#ec008c'],
    ocean: ['#00c6ff', '#0072ff', '#0a1128', '#1c3144', '#007f5f', '#2ec4b6'],
    monochrome: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
    custom: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']
};

const DEFAULT_NAMES = [
    "Alice", "Bob", "Charlie", "David", 
    "Emma", "Frank", "Grace", "Henry",
    "Ivy", "Jack"
];

// App State
let state = {
    activeTabIndex: 0,
    wheels: [], // List of wheels
    history: [], // List of { name, timestamp, wheelName }
    theme: 'dark',
    isMuted: false,
    isGridView: false // Layout mode
};

// Animation state tracked per wheel index
let wheelAngles = [];
let spinStates = [];
let spinStarts = [];
let animationIds = [];
let lastTickSliceIndexes = [];
const imageCache = new Map(); // Cache image elements for image-based slices
let centerImageElement = null; // Cached HTMLImageElement for center logo

// Initializer
window.addEventListener('DOMContentLoaded', () => {
    loadState();
    initTheme();
    initAudioVolume();
    checkUrlHash();
    
    renderWheelLayout();
    renderTabs();
    syncSidebar();
    drawAllWheels();
    renderHistory();
    
    setupEventListeners();
});

// Load state from localStorage or load defaults
function loadState() {
    try {
        const savedState = localStorage.getItem('spinnerWheels_state');
        if (savedState) {
            state = JSON.parse(savedState);
            if (!state.wheels || state.wheels.length === 0) {
                state.wheels = [createDefaultWheel('Wheel 1')];
            } else {
                // Migrate old low-contrast rainbow colors to new high-contrast alternating palette
                const oldRainbowStr = JSON.stringify(['#ff416c', '#ff4b2b', '#ff8c00', '#4caf50', '#00bcd4', '#2196f3', '#9c27b0', '#e91e63']);
                state.wheels.forEach(wheel => {
                    if (JSON.stringify(wheel.colors) === oldRainbowStr) {
                        wheel.colors = [...PALETTES.rainbow];
                    }
                });
            }
        } else {
            state.wheels = [
                createDefaultWheel('Wheel 1'),
                createDefaultWheel('Wheel 2')
            ];
            state.activeTabIndex = 0;
            state.history = [];
            state.theme = 'dark';
            state.isMuted = false;
            state.isGridView = false;
        }
        
        // Initialize animation state arrays corresponding to wheel count
        initAnimationStates();
    } catch (e) {
        console.error("Failed to load state from localStorage:", e);
        state.wheels = [createDefaultWheel('Wheel 1')];
        initAnimationStates();
    }
}

function initAnimationStates() {
    const count = state.wheels.length;
    wheelAngles = new Array(count).fill(0);
    spinStates = new Array(count).fill(false);
    spinStarts = new Array(count).fill(0);
    animationIds = new Array(count).fill(null);
    lastTickSliceIndexes = new Array(count).fill(-1);
}

// Save state to localStorage
function saveState() {
    try {
        localStorage.setItem('spinnerWheels_state', JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
    }
}

function createDefaultWheel(name = 'New Wheel') {
    return {
        name: name,
        entries: DEFAULT_NAMES.map(name => ({ text: name, weight: 1, image: null })),
        colors: [...PALETTES.rainbow],
        settings: {
            spinSound: 'plastic',
            spinDuration: 10,
            maxNames: 100,
            winnerSound: 'applause',
            autoRemoveWinner: false,
            showConfetti: true,
            winnerMessage: 'We have a winner!',
            centerType: 'text',
            centerEmoji: '🎉',
            centerImage: null,
            rotateCenterLogo: true
        }
    };
}

function checkUrlHash() {
    if (window.location.hash) {
        const sharedWheel = decompressFromHash(window.location.hash);
        if (sharedWheel) {
            state.wheels.push(sharedWheel);
            state.activeTabIndex = state.wheels.length - 1;
            initAnimationStates();
            saveState();
            window.history.replaceState(null, null, ' ');
        }
    }
}

// Active wheel helper
function getActiveWheel() {
    return state.wheels[state.activeTabIndex] || state.wheels[0];
}

// Initialize theme from state
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (state.theme === 'light') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

function initAudioVolume() {
    setMasterVolume(state.isMuted ? 0 : 0.5);
    const volumeHigh = document.querySelector('.volume-high');
    const volumeMute = document.querySelector('.volume-mute');
    if (state.isMuted) {
        volumeHigh.style.display = 'none';
        volumeMute.style.display = 'block';
    } else {
        volumeHigh.style.display = 'block';
        volumeMute.style.display = 'none';
    }
}

/* LAYOUT & TAB RENDERING */

function renderWheelLayout() {
    const section = document.querySelector('.wheel-section');
    const spinAllBtn = document.getElementById('spinAllBtn');
    const toggleGridBtn = document.getElementById('toggleGridBtn');
    
    if (state.isGridView) {
        section.classList.add('grid-active');
        spinAllBtn.style.display = 'inline-flex';
        toggleGridBtn.querySelector('span').textContent = 'Solo View';
        
        // Rebuild multiple wheels in grid
        section.innerHTML = '';
        state.wheels.forEach((wheel, index) => {
            const outer = document.createElement('div');
            outer.className = `wheel-canvas-outer ${index === state.activeTabIndex ? 'active' : ''}`;
            outer.dataset.index = index;
            outer.style.cursor = 'pointer';
            
            // Add click tab switch on wrapper
            outer.addEventListener('click', (e) => {
                if (e.target.closest('.spin-center-btn')) return; // Ignore if clicking spin button
                state.activeTabIndex = index;
                document.querySelectorAll('.wheel-canvas-outer').forEach(el => el.classList.remove('active'));
                outer.classList.add('active');
                saveState();
                renderTabs();
                syncSidebar();
            });
            
            outer.innerHTML = `
                <div class="wheel-grid-header">
                    <span class="wheel-grid-title">${wheel.name}</span>
                </div>
                <div class="wheel-canvas-container">
                    <canvas id="wheelCanvas-${index}"></canvas>
                    <button class="spin-center-btn" id="spinCenterBtn-${index}" data-index="${index}">
                        <span class="spin-text">SPIN</span>
                    </button>
                </div>
                <div class="wheel-pointer-container">
                    <svg class="wheel-pointer" viewBox="0 0 24 24" width="32" height="32">
                        <path d="M22 12L2 4L6 12L2 20Z" fill="url(#pointerGradGrid-${index})" filter="url(#shadowGrid-${index})"/>
                        <defs>
                            <linearGradient id="pointerGradGrid-${index}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#ff416c" />
                                <stop offset="100%" stop-color="#ff4b2b" />
                            </linearGradient>
                            <filter id="shadowGrid-${index}" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="1" dy="2" stdDeviation="1" flood-opacity="0.5"/>
                            </filter>
                        </defs>
                    </svg>
                </div>
            `;
            section.appendChild(outer);
            
            // Attach spin handler
            outer.querySelector(`.spin-center-btn`).addEventListener('click', (e) => {
                e.stopPropagation();
                spinIndividualWheel(index);
            });
            outer.querySelector(`canvas`).addEventListener('click', (e) => {
                e.stopPropagation();
                spinIndividualWheel(index);
            });
        });
    } else {
        section.classList.remove('grid-active');
        spinAllBtn.style.display = 'none';
        toggleGridBtn.querySelector('span').textContent = 'Grid View';
        
        // Restore single wheel layout
        section.innerHTML = `
            <div class="wheel-canvas-outer">
                <div class="wheel-canvas-container" id="canvasContainer">
                    <canvas id="wheelCanvas"></canvas>
                    <button class="spin-center-btn" id="spinCenterBtn">
                        <span class="spin-text">SPIN</span>
                    </button>
                </div>
                <div class="wheel-pointer-container">
                    <svg class="wheel-pointer" viewBox="0 0 24 24" width="48" height="48">
                        <path d="M22 12L2 4L6 12L2 20Z" fill="url(#pointerGrad)" filter="url(#shadow)"/>
                        <defs>
                            <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#ff416c" />
                                <stop offset="100%" stop-color="#ff4b2b" />
                            </linearGradient>
                            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity="0.5"/>
                            </filter>
                        </defs>
                    </svg>
                </div>
            </div>
        `;
        
        // Attach solo handlers
        document.getElementById('spinCenterBtn').addEventListener('click', () => spinIndividualWheel(state.activeTabIndex));
        document.getElementById('wheelCanvas').addEventListener('click', () => spinIndividualWheel(state.activeTabIndex));
    }
}

// Render tab strip
function renderTabs() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    
    state.wheels.forEach((wheel, index) => {
        const tab = document.createElement('div');
        tab.className = `tab ${index === state.activeTabIndex ? 'active' : ''}`;
        tab.dataset.index = index;
        
        const tabTitle = document.createElement('span');
        tabTitle.className = 'tab-title';
        tabTitle.textContent = wheel.name;
        tabTitle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            renameTab(index);
        });
        tab.appendChild(tabTitle);
        
        // Only allow closing if there's more than 1 tab
        if (state.wheels.length > 1) {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(index);
            });
            tab.appendChild(closeBtn);
        }
        
        tab.addEventListener('click', () => {
            if (spinStates.includes(true)) return; // Prevent tab switch during active spin
            state.activeTabIndex = index;
            saveState();
            renderTabs();
            syncSidebar();
            if (state.isGridView) {
                document.querySelectorAll('.wheel-canvas-outer').forEach((el, idx) => {
                    if (idx === index) el.classList.add('active');
                    else el.classList.remove('active');
                });
            } else {
                drawAllWheels();
            }
        });
        
        container.appendChild(tab);
    });
}

function renameTab(index) {
    if (spinStates.includes(true)) return;
    const wheel = state.wheels[index];
    const newName = prompt("Rename your wheel:", wheel.name);
    if (newName && newName.trim() !== "") {
        wheel.name = newName.trim();
        saveState();
        renderTabs();
        if (state.isGridView) renderWheelLayout();
        drawAllWheels();
    }
}

function closeTab(index) {
    if (spinStates.includes(true)) return;
    state.wheels.splice(index, 1);
    if (state.activeTabIndex >= state.wheels.length) {
        state.activeTabIndex = state.wheels.length - 1;
    }
    initAnimationStates();
    saveState();
    renderWheelLayout();
    renderTabs();
    syncSidebar();
    drawAllWheels();
}

// Update entries sidebar editor with active wheel data
function syncSidebar() {
    const wheel = getActiveWheel();
    const textarea = document.getElementById('entriesTextarea');
    
    const textLines = wheel.entries.map(e => {
        if (e.weight > 1) {
            return `${e.text} *${e.weight}`;
        }
        return e.text;
    });
    
    textarea.value = textLines.join('\n');
    updateEntryCount();
}

function updateEntryCount() {
    const wheel = getActiveWheel();
    const countText = document.getElementById('entryCountText');
    const totalEntries = wheel.entries.length;
    const totalWeight = wheel.entries.reduce((acc, curr) => acc + curr.weight, 0);
    
    const label = wheel.name || 'Wheel';
    if (totalWeight > totalEntries) {
        countText.textContent = `${label}: ${totalEntries} entries (${totalWeight} total weight)`;
    } else {
        countText.textContent = `${label}: ${totalEntries} entries`;
    }
}

// Convert textarea text to entries list
function parseTextarea() {
    const textarea = document.getElementById('entriesTextarea');
    const lines = textarea.value.split('\n');
    const wheel = getActiveWheel();
    
    const newEntries = [];
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed === "") return;
        
        let text = trimmed;
        let weight = 1;
        const weightMatch = trimmed.match(/(.*?)\s*[\*:]\s*(\d+)$/);
        
        if (weightMatch) {
            text = weightMatch[1].trim();
            weight = parseInt(weightMatch[2], 10) || 1;
        }
        
        const existing = wheel.entries.find(e => e.text === text);
        const image = existing ? existing.image : null;
        
        newEntries.push({ text, weight, image });
    });
    
    wheel.entries = newEntries;
    saveState();
    updateEntryCount();
    drawAllWheels();
}

/* CANVAS DRAWING */

function drawAllWheels() {
    if (state.isGridView) {
        state.wheels.forEach((_, idx) => {
            drawWheelAtIdx(idx);
        });
    } else {
        drawWheelAtIdx(state.activeTabIndex);
    }
}

function drawWheelAtIdx(index) {
    const canvasId = state.isGridView ? `wheelCanvas-${index}` : 'wheelCanvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight);
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    
    const wheel = state.wheels[index];
    const entries = wheel.entries;
    
    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2 - (state.isGridView ? 6 : 10);
    const innerRadius = state.isGridView ? 20 : 35; // Center hub radius
    
    ctx.clearRect(0, 0, size, size);
    
    if (entries.length === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#334155';
        ctx.stroke();
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${state.isGridView ? '11' : '15'}px var(--font-primary)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Empty', centerX, centerY);
        return;
    }
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1016';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = state.isGridView ? 6 : 12;
    ctx.shadowOffsetY = state.isGridView ? 3 : 6;
    ctx.fill();
    ctx.restore();
    
    const angle = wheelAngles[index] || 0;
    let currentStartAngle = angle;
    
    const numVisible = Math.min(entries.length, wheel.settings.maxNames || 100);
    const visibleEntries = entries.slice(0, numVisible);
    const visibleWeight = visibleEntries.reduce((acc, curr) => acc + curr.weight, 0);

    visibleEntries.forEach((entry, idx) => {
        const sliceWeight = entry.weight;
        const sliceAngle = (2 * Math.PI) * (sliceWeight / visibleWeight);
        const endAngle = currentStartAngle + sliceAngle;
        const midAngle = currentStartAngle + sliceAngle / 2;
        
        const color = wheel.colors[idx % wheel.colors.length];
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, outerRadius, currentStartAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(midAngle);
        
        const contrastColor = getContrastColor(color);
        
        if (entry.image) {
            const img = getCachedImage(entry.image, () => drawWheelAtIdx(index));
            if (img && img.complete) {
                const imgSize = Math.min(state.isGridView ? 22 : 45, (outerRadius - innerRadius) * 0.4);
                ctx.save();
                ctx.translate(outerRadius * 0.65, 0);
                ctx.rotate(Math.PI / 2);
                
                ctx.beginPath();
                ctx.arc(0, 0, imgSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                ctx.drawImage(img, -imgSize/2, -imgSize/2, imgSize, imgSize);
                ctx.restore();
            }
        } else {
            const maxLength = outerRadius - innerRadius - (state.isGridView ? 15 : 35);
            
            let fontSize = 16;
            if (state.isGridView) {
                if (numVisible > 80) fontSize = 5;
                else if (numVisible > 50) fontSize = 6;
                else if (numVisible > 30) fontSize = 7;
                else if (numVisible > 15) fontSize = 9;
                else fontSize = 11;
            } else {
                if (numVisible > 80) fontSize = 8;
                else if (numVisible > 50) fontSize = 10;
                else if (numVisible > 30) fontSize = 12;
                else if (numVisible > 15) fontSize = 14;
            }
            
            ctx.fillStyle = contrastColor;
            ctx.font = `600 ${fontSize}px var(--font-primary)`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            
            let displayText = entry.text;
            let textWidth = ctx.measureText(displayText).width;
            if (textWidth > maxLength) {
                while (textWidth > maxLength && displayText.length > 2) {
                    displayText = displayText.slice(0, -1);
                    textWidth = ctx.measureText(displayText + '...').width;
                }
                displayText += '...';
            }
            
            ctx.fillText(displayText, outerRadius - (state.isGridView ? 8 : 18), 0);
        }
        ctx.restore();
        
        currentStartAngle = endAngle;
    });
    
    drawCenterHub(index, ctx, centerX, centerY, innerRadius, wheel);
}

function drawCenterHub(index, ctx, centerX, centerY, radius, wheel) {
    const settings = wheel.settings;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    
    if (settings.rotateCenterLogo && settings.centerType !== 'text') {
        ctx.rotate(wheelAngles[index] || 0);
    }
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    
    ctx.lineWidth = state.isGridView ? 1.5 : 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    
    if (settings.centerType === 'emoji') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${radius * (state.isGridView ? 1.1 : 0.9)}px var(--font-primary)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(settings.centerEmoji || '🎉', 0, 0);
    } else if (settings.centerType === 'image' && settings.centerImage) {
        const img = getCenterLogoImage(settings.centerImage, index);
        if (img && img.complete) {
            ctx.beginPath();
            ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
        }
    }
    
    ctx.restore();
}

function getCachedImage(base64, onLoadCallback) {
    if (imageCache.has(base64)) {
        return imageCache.get(base64);
    }
    const img = new Image();
    img.src = base64;
    img.onload = () => {
        onLoadCallback();
    };
    imageCache.set(base64, img);
    return img;
}

function getCenterLogoImage(base64, index) {
    if (centerImageElement && centerImageElement.src === base64) {
        return centerImageElement;
    }
    centerImageElement = new Image();
    centerImageElement.src = base64;
    centerImageElement.onload = () => {
        drawWheelAtIdx(index);
    };
    return centerImageElement;
}

function getContrastColor(hexcolor) {
    let color = hexcolor.replace('#', '');
    if (color.length === 3) {
        color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 140) ? '#1e293b' : '#ffffff';
}

/* SPIN ACTIONS (SOLO AND GRID CONCURRENT) */

// Spin a single wheel by index
export function spinIndividualWheel(index) {
    if (spinStates[index]) return;
    
    const wheel = state.wheels[index];
    if (!wheel || wheel.entries.length === 0) return;
    
    spinStates[index] = true;
    stopConfetti();
    
    // Disable respective spin button
    const btnId = state.isGridView ? `spinCenterBtn-${index}` : 'spinCenterBtn';
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.style.opacity = '0.3';
        btn.style.pointerEvents = 'none';
    }
    
    const spinDuration = wheel.settings.spinDuration * 1000;
    spinStarts[index] = performance.now();
    
    const cryptoArr = new Uint32Array(1);
    window.crypto.getRandomValues(cryptoArr);
    
    const numVisible = Math.min(wheel.entries.length, wheel.settings.maxNames || 100);
    const visibleEntries = wheel.entries.slice(0, numVisible);
    const visibleWeight = visibleEntries.reduce((acc, curr) => acc + curr.weight, 0);
    
    const randomWeight = (cryptoArr[0] / 0xffffffff) * visibleWeight;
    let accumulatedWeight = 0;
    let winnerIndex = 0;
    for (let i = 0; i < visibleEntries.length; i++) {
        accumulatedWeight += visibleEntries[i].weight;
        if (randomWeight <= accumulatedWeight) {
            winnerIndex = i;
            break;
        }
    }
    
    let sliceStartAngleSum = 0;
    for (let i = 0; i < winnerIndex; i++) {
        sliceStartAngleSum += (2 * Math.PI) * (visibleEntries[i].weight / visibleWeight);
    }
    const sliceAngleWidth = (2 * Math.PI) * (visibleEntries[winnerIndex].weight / visibleWeight);
    const targetLocalAngle = sliceStartAngleSum + (sliceAngleWidth * 0.5);
    
    const numSpins = 6 + (cryptoArr[0] % 6);
    const targetTotalAngle = (numSpins * 2 * Math.PI) - targetLocalAngle;
    
    const startWheelAngle = (wheelAngles[index] || 0) % (2 * Math.PI);
    const deltaAngle = targetTotalAngle - startWheelAngle;
    
    lastTickSliceIndexes[index] = -1;
    
    const xa = 0.15;
    const B = 1 / ((1 - xa) * (1 - xa) * (1 + 0.5 * xa));
    const A = 1.5 / (xa * (1 + 0.5 * xa));
    
    function animate(now) {
        const elapsed = now - spinStarts[index];
        const progress = Math.min(elapsed / spinDuration, 1);
        
        let easeVal = 0;
        if (progress <= xa) {
            easeVal = A * progress * progress;
        } else {
            const complement = 1 - progress;
            easeVal = 1 - B * complement * complement * complement;
        }
        
        wheelAngles[index] = startWheelAngle + deltaAngle * easeVal;
        drawWheelAtIdx(index);
        
        const localPointerAngle = (2 * Math.PI - (wheelAngles[index] % (2 * Math.PI))) % (2 * Math.PI);
        const currentSliceIndex = getSliceIndexAtAngle(localPointerAngle, visibleEntries, visibleWeight);
        
        if (currentSliceIndex !== lastTickSliceIndexes[index] && lastTickSliceIndexes[index] !== -1) {
            const speed = progress <= xa 
                ? 2 * A * progress 
                : 3 * B * (1 - progress) * (1 - progress);
            
            if (speed > 0.05) {
                playTick(wheel.settings.spinSound, 0.4 + (speed * 0.2));
            }
        }
        lastTickSliceIndexes[index] = currentSliceIndex;
        
        if (progress < 1) {
            animationIds[index] = requestAnimationFrame(animate);
        } else {
            spinStates[index] = false;
            wheelAngles[index] = startWheelAngle + deltaAngle;
            drawWheelAtIdx(index);
            
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
            
            handleWinnerSelection(visibleEntries[winnerIndex], index);
        }
    }
    
    animationIds[index] = requestAnimationFrame(animate);
}

function getSliceIndexAtAngle(angle, entries, totalWeight) {
    let accumulatedAngle = 0;
    for (let i = 0; i < entries.length; i++) {
        const sliceAngle = (2 * Math.PI) * (entries[i].weight / totalWeight);
        if (angle >= accumulatedAngle && angle < accumulatedAngle + sliceAngle) {
            return i;
        }
        accumulatedAngle += sliceAngle;
    }
    return 0;
}

// Spin all wheels simultaneously (Grid Mode only)
function spinAllWheels() {
    if (!state.isGridView) return;
    state.wheels.forEach((_, idx) => {
        spinIndividualWheel(idx);
    });
}

// Handle winner selection
function handleWinnerSelection(winnerEntry, wheelIndex) {
    const wheel = state.wheels[wheelIndex];
    
    playWinner(wheel.settings.winnerSound, 0.8);
    
    if (wheel.settings.showConfetti) {
        startConfetti(5000);
    }
    
    const displayElement = document.getElementById('winnerNameDisplay');
    displayElement.textContent = winnerEntry.text;
    
    const messageTemplate = wheel.settings.winnerMessage || 'We have a winner!';
    document.getElementById('winnerMessageText').textContent = messageTemplate.replace('{winner}', winnerEntry.text);
    
    // Store record in history
    const historyItem = {
        name: winnerEntry.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        wheelName: wheel.name
    };
    state.history.unshift(historyItem);
    saveState();
    renderHistory();
    
    // Always open the winner modal
    openWinnerModal();
    
    let autoRemoveTimeout = null;
    
    const handleNextWheel = () => {
        if (autoRemoveTimeout) {
            clearTimeout(autoRemoveTimeout);
        }
        closeWinnerModal();
        
        if (wheel.settings.autoRemoveWinner) {
            removeWinner(winnerEntry.text, wheelIndex);
        }
        
        // Transition focus to the next wheel in sequence
        const nextIndex = (wheelIndex + 1) % state.wheels.length;
        state.activeTabIndex = nextIndex;
        saveState();
        
        renderTabs();
        syncSidebar();
        if (state.isGridView) {
            renderWheelLayout();
        }
        drawAllWheels();
    };
    
    const nextBtn = document.getElementById('nextWheelWinnerBtn');
    if (nextBtn) {
        nextBtn.onclick = handleNextWheel;
    }
    
    if (wheel.settings.autoRemoveWinner) {
        autoRemoveTimeout = setTimeout(() => {
            handleNextWheel();
        }, 1500);
    }
}

function removeWinner(winnerName, wheelIndex) {
    const wheel = state.wheels[wheelIndex];
    const idx = wheel.entries.findIndex(e => e.text === winnerName);
    if (idx !== -1) {
        wheel.entries.splice(idx, 1);
        saveState();
        syncSidebar();
        drawWheelAtIdx(wheelIndex);
    }
}

/* SIDEBAR AND MODALS MANAGEMENT */

function openWinnerModal() {
    document.getElementById('winnerModal').classList.add('open');
}

function closeWinnerModal() {
    document.getElementById('winnerModal').classList.remove('open');
    stopConfetti();
}

function openCustomizeModal() {
    const wheel = getActiveWheel();
    const settings = wheel.settings;
    
    document.getElementById('spinSoundSelect').value = settings.spinSound;
    document.getElementById('spinDurationRange').value = settings.spinDuration;
    document.getElementById('spinDurationVal').textContent = settings.spinDuration;
    
    document.getElementById('maxNamesRange').value = settings.maxNames || 100;
    document.getElementById('maxNamesVal').textContent = settings.maxNames || 100;
    
    document.getElementById('winnerSoundSelect').value = settings.winnerSound;
    document.getElementById('autoRemoveWinnerCheckbox').checked = settings.autoRemoveWinner;
    document.getElementById('showConfettiCheckbox').checked = settings.showConfetti;
    document.getElementById('winnerMessageInput').value = settings.winnerMessage;
    
    let presetMatch = 'custom';
    for (const [key, colors] of Object.entries(PALETTES)) {
        if (key === 'custom') continue;
        if (JSON.stringify(wheel.colors) === JSON.stringify(colors)) {
            presetMatch = key;
            break;
        }
    }
    document.getElementById('presetPaletteSelect').value = presetMatch;
    
    renderCustomPalettePickers(wheel.colors);
    togglePalettePickerGroup(presetMatch === 'custom');
    
    document.getElementById('centerTypeSelect').value = settings.centerType;
    document.getElementById('centerEmojiInput').value = settings.centerEmoji || '🎉';
    toggleHubOptions(settings.centerType);
    document.getElementById('rotateCenterLogoCheckbox').checked = settings.rotateCenterLogo;
    
    document.getElementById('customizeModal').classList.add('open');
}

function toggleHubOptions(type) {
    document.getElementById('centerEmojiGroup').style.display = type === 'emoji' ? 'block' : 'none';
    document.getElementById('centerImageGroup').style.display = type === 'image' ? 'block' : 'none';
}

function togglePalettePickerGroup(show) {
    document.getElementById('customColorPaletteGroup').style.display = show ? 'block' : 'none';
}

function renderCustomPalettePickers(colors) {
    const list = document.getElementById('colorPickersList');
    list.innerHTML = '';
    
    colors.forEach((col, index) => {
        const item = document.createElement('div');
        item.className = 'color-picker-item';
        
        item.innerHTML = `
            <div class="color-bubble" style="background-color: ${col}">
                <input type="color" value="${col}" data-index="${index}">
            </div>
            ${colors.length > 2 ? `<button class="btn-remove-color" data-index="${index}">&times;</button>` : ''}
        `;
        
        item.querySelector('input').addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            colors[idx] = e.target.value;
            e.target.parentElement.style.backgroundColor = e.target.value;
        });
        
        const remBtn = item.querySelector('.btn-remove-color');
        if (remBtn) {
            remBtn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                colors.splice(idx, 1);
                renderCustomPalettePickers(colors);
            });
        }
        list.appendChild(item);
    });
}

function closeCustomizeModal() {
    document.getElementById('customizeModal').classList.remove('open');
}

function saveCustomizationSettings() {
    const wheel = getActiveWheel();
    const settings = wheel.settings;
    
    settings.spinSound = document.getElementById('spinSoundSelect').value;
    settings.spinDuration = parseInt(document.getElementById('spinDurationRange').value, 10);
    settings.maxNames = parseInt(document.getElementById('maxNamesRange').value, 10);
    
    settings.winnerSound = document.getElementById('winnerSoundSelect').value;
    settings.autoRemoveWinner = document.getElementById('autoRemoveWinnerCheckbox').checked;
    settings.showConfetti = document.getElementById('showConfettiCheckbox').checked;
    settings.winnerMessage = document.getElementById('winnerMessageInput').value;
    
    const paletteType = document.getElementById('presetPaletteSelect').value;
    if (paletteType !== 'custom') {
        wheel.colors = [...PALETTES[paletteType]];
    }
    
    settings.centerType = document.getElementById('centerTypeSelect').value;
    settings.centerEmoji = document.getElementById('centerEmojiInput').value;
    settings.rotateCenterLogo = document.getElementById('rotateCenterLogoCheckbox').checked;
    
    const bgCol = document.getElementById('wheelBgColor').value;
    document.querySelector('.wheel-section').style.backgroundColor = bgCol;
    
    saveState();
    closeCustomizeModal();
    drawAllWheels();
}

/* RESULTS HISTORY RENDERING */
function renderHistory() {
    const container = document.getElementById('resultsList');
    container.innerHTML = '';
    
    if (state.history.length === 0) {
        container.innerHTML = '<div class="empty-state">No winners yet. Spin the wheel!</div>';
        return;
    }
    
    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        div.innerHTML = `
            <div class="saved-wheel-details">
                <span class="result-name">${item.name}</span>
                <span class="saved-wheel-meta">${item.wheelName}</span>
            </div>
            <span class="result-time">${item.timestamp}</span>
        `;
        container.appendChild(div);
    });
}

/* SAVED WHEELS MANAGER */
function openSavedWheelsModal() {
    const container = document.getElementById('savedWheelsList');
    container.innerHTML = '';
    
    let savedList = [];
    try {
        const saved = localStorage.getItem('spinnerWheels_saved_wheels');
        if (saved) savedList = JSON.parse(saved);
    } catch (e) {}
    
    if (savedList.length === 0) {
        container.innerHTML = '<div class="empty-state">No saved wheels yet. Use "Save Current Wheel" from the menu.</div>';
        document.getElementById('savedWheelsModal').classList.add('open');
        return;
    }
    
    savedList.forEach((savedWheel, idx) => {
        const div = document.createElement('div');
        div.className = 'saved-wheel-item';
        
        div.innerHTML = `
            <div class="saved-wheel-details">
                <span class="saved-wheel-name">${savedWheel.name}</span>
                <span class="saved-wheel-meta">${savedWheel.entries.length} names • Saved ${savedWheel.date || ''}</span>
            </div>
            <div class="saved-wheel-actions">
                <button class="btn btn-sm btn-primary" data-action="load" data-index="${idx}">Load</button>
                <button class="btn btn-sm btn-danger btn-icon-only" data-action="delete" data-index="${idx}">&times;</button>
            </div>
        `;
        
        div.querySelector('[data-action="load"]').addEventListener('click', () => {
            if (spinStates.includes(true)) return;
            state.wheels[state.activeTabIndex] = JSON.parse(JSON.stringify(savedWheel));
            saveState();
            renderTabs();
            syncSidebar();
            drawAllWheels();
            document.getElementById('savedWheelsModal').classList.remove('open');
        });
        
        div.querySelector('[data-action="delete"]').addEventListener('click', () => {
            savedList.splice(idx, 1);
            localStorage.setItem('spinnerWheels_saved_wheels', JSON.stringify(savedList));
            openSavedWheelsModal();
        });
        
        container.appendChild(div);
    });
    
    document.getElementById('savedWheelsModal').classList.add('open');
}

function saveCurrentWheel() {
    const wheel = getActiveWheel();
    const wheelName = prompt("Name your wheel before saving:", wheel.name);
    if (!wheelName) return;
    
    wheel.name = wheelName;
    renderTabs();
    
    let savedList = [];
    try {
        const saved = localStorage.getItem('spinnerWheels_saved_wheels');
        if (saved) savedList = JSON.parse(saved);
    } catch (e) {}
    
    const wheelToSave = JSON.parse(JSON.stringify(wheel));
    wheelToSave.date = new Date().toLocaleDateString();
    
    const existingIdx = savedList.findIndex(w => w.name === wheelName);
    if (existingIdx !== -1) {
        if (confirm(`A saved wheel named "${wheelName}" already exists. Overwrite?`)) {
            savedList[existingIdx] = wheelToSave;
        } else {
            return;
        }
    } else {
        savedList.push(wheelToSave);
    }
    
    localStorage.setItem('spinnerWheels_saved_wheels', JSON.stringify(savedList));
    alert('Wheel saved successfully!');
}

/* QUICK POPULATE GENERATORS */
function setupQuickFill() {
    const drop = document.getElementById('quickFillDropdown');
    document.getElementById('quickFillBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        drop.classList.toggle('open');
    });
    
    window.addEventListener('click', () => {
        drop.classList.remove('open');
    });
    
    document.getElementById('fillAlphaBtn').addEventListener('click', () => {
        const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({ text: letter, weight: 1, image: null }));
        populateActiveWheel(alpha);
    });
    
    document.getElementById('fillNum10Btn').addEventListener('click', () => {
        const nums = Array.from({ length: 10 }, (_, i) => ({ text: String(i + 1), weight: 1, image: null }));
        populateActiveWheel(nums);
    });
    
    document.getElementById('fillNum100Btn').addEventListener('click', () => {
        const nums = Array.from({ length: 100 }, (_, i) => ({ text: String(i + 1), weight: 1, image: null }));
        populateActiveWheel(nums);
    });
    
    document.getElementById('fillDaysBtn').addEventListener('click', () => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({ text: day, weight: 1, image: null }));
        populateActiveWheel(days);
    });
    
    document.getElementById('fillClearBtn').addEventListener('click', () => {
        populateActiveWheel([]);
    });
}

function populateActiveWheel(newEntries) {
    if (spinStates.includes(true)) return;
    const wheel = getActiveWheel();
    wheel.entries = newEntries;
    saveState();
    syncSidebar();
    drawAllWheels();
}

/* TEAM GENERATOR LOGIC */
function setupTeamGenerator() {
    const modal = document.getElementById('teamModal');
    const container = document.getElementById('teamResultsContainer');
    const list = document.getElementById('teamsList');
    
    document.getElementById('teamGeneratorBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        
        const wheel = getActiveWheel();
        if (wheel.entries.length < 2) {
            alert("Please add at least 2 entries to generate teams!");
            return;
        }
        
        container.style.display = 'none';
        modal.classList.add('open');
    });
    
    document.getElementById('closeTeamModalBtn').addEventListener('click', () => {
        modal.classList.remove('open');
    });
    
    document.getElementById('generateTeamsSubmitBtn').addEventListener('click', () => {
        const teamCount = parseInt(document.getElementById('teamCountInput').value, 10);
        if (isNaN(teamCount) || teamCount < 2) {
            alert("Please enter a valid group count of 2 or more.");
            return;
        }
        
        const wheel = getActiveWheel();
        const entriesCopy = [...wheel.entries];
        
        // Shuffle entries
        for (let i = entriesCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [entriesCopy[i], entriesCopy[j]] = [entriesCopy[j], entriesCopy[i]];
        }
        
        // Distribute round-robin into groups
        const groups = Array.from({ length: teamCount }, (_, i) => ({
            name: `Team ${i + 1}`,
            members: []
        }));
        
        entriesCopy.forEach((entry, idx) => {
            groups[idx % teamCount].members.push(entry.text);
        });
        
        // Render groups
        list.innerHTML = '';
        groups.forEach(g => {
            if (g.members.length === 0) return;
            const box = document.createElement('div');
            box.className = 'team-box';
            
            box.innerHTML = `
                <div class="team-name">${g.name}</div>
                <div class="team-members">${g.members.join(', ')}</div>
            `;
            list.appendChild(box);
        });
        
        container.style.display = 'block';
    });
    
    document.getElementById('copyTeamsBtn').addEventListener('click', () => {
        const boxes = list.querySelectorAll('.team-box');
        let text = '';
        boxes.forEach(box => {
            const name = box.querySelector('.team-name').textContent;
            const members = box.querySelector('.team-members').textContent;
            text += `${name}: ${members}\n`;
        });
        
        navigator.clipboard.writeText(text).then(() => {
            alert("Teams copied to clipboard!");
        }).catch(e => {
            console.error("Failed to copy teams:", e);
        });
    });
}

/* EVENT LISTENERS SETUP */
function setupEventListeners() {
    // 1. Solo Spacebar Spin
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
            if (state.isGridView) {
                spinAllWheels();
            } else {
                spinIndividualWheel(state.activeTabIndex);
            }
        }
    });

    // 2. Sidebar Tab switches
    const tabEntries = document.getElementById('tabEntriesBtn');
    const tabResults = document.getElementById('tabResultsBtn');
    const panelEntries = document.getElementById('panelEntries');
    const panelResults = document.getElementById('panelResults');
    
    tabEntries.addEventListener('click', () => {
        tabEntries.classList.add('active');
        tabResults.classList.remove('active');
        panelEntries.classList.add('active');
        panelResults.classList.remove('active');
    });
    
    tabResults.addEventListener('click', () => {
        tabResults.classList.add('active');
        tabEntries.classList.remove('active');
        panelResults.classList.add('active');
        panelEntries.classList.remove('active');
    });
    
    // 3. Sidebar text modifications
    const textarea = document.getElementById('entriesTextarea');
    textarea.addEventListener('input', parseTextarea);
    
    // Shuffle & Sort
    document.getElementById('shuffleEntriesBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        const wheel = getActiveWheel();
        for (let i = wheel.entries.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wheel.entries[i], wheel.entries[j]] = [wheel.entries[j], wheel.entries[i]];
        }
        saveState();
        syncSidebar();
        drawAllWheels();
    });
    
    document.getElementById('sortEntriesBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        const wheel = getActiveWheel();
        wheel.entries.sort((a, b) => a.text.localeCompare(b.text));
        saveState();
        syncSidebar();
        drawAllWheels();
    });
    
    document.getElementById('clearEntriesBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        if (confirm("Clear all entries?")) {
            populateActiveWheel([]);
        }
    });
    
    // Results clear
    document.getElementById('clearResultsBtn').addEventListener('click', () => {
        if (confirm("Clear results history?")) {
            state.history = [];
            saveState();
            renderHistory();
        }
    });
    
    // Image slice uploads
    const addImgBtn = document.getElementById('addImageEntryBtn');
    const fileInput = document.getElementById('imageFileInput');
    
    addImgBtn.addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const wheel = getActiveWheel();
            
            const name = file.name.substring(0, file.name.lastIndexOf('.')) || 'Image';
            wheel.entries.push({ text: name, weight: 1, image: base64 });
            
            saveState();
            syncSidebar();
            drawAllWheels();
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });
    
    // 4. Header buttons: Add Tab, Share, Open/Save menu toggles
    document.getElementById('addTabBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        const num = state.wheels.length + 1;
        state.wheels.push(createDefaultWheel(`Wheel ${num}`));
        state.activeTabIndex = state.wheels.length - 1;
        initAnimationStates();
        saveState();
        if (state.isGridView) renderWheelLayout();
        renderTabs();
        syncSidebar();
        drawAllWheels();
    });
    
    const dropdown = document.querySelector('.dropdown');
    document.getElementById('saveLoadBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });
    
    window.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });
    
    document.getElementById('saveWheelBtn').addEventListener('click', saveCurrentWheel);
    document.getElementById('openWheelsBtn').addEventListener('click', openSavedWheelsModal);
    
    // Layout switches (Grid Mode vs Solo Mode)
    document.getElementById('toggleGridBtn').addEventListener('click', () => {
        if (spinStates.includes(true)) return;
        state.isGridView = !state.isGridView;
        saveState();
        renderWheelLayout();
        renderTabs();
        drawAllWheels();
    });
    
    document.getElementById('spinAllBtn').addEventListener('click', spinAllWheels);
    
    // Customize & Share click handlers
    document.getElementById('customizeBtn').addEventListener('click', openCustomizeModal);
    
    document.getElementById('shareBtn').addEventListener('click', () => {
        const url = generateShareUrl(getActiveWheel());
        document.getElementById('shareUrlInput').value = url;
        document.getElementById('shareSuccessMsg').style.display = 'none';
        document.getElementById('shareModal').classList.add('open');
    });
    
    // Close Modals
    document.getElementById('closeCustomizeModalBtn').addEventListener('click', closeCustomizeModal);
    document.getElementById('cancelCustomizeBtn').addEventListener('click', closeCustomizeModal);
    document.getElementById('applyCustomizeBtn').addEventListener('click', saveCustomizationSettings);
    
    document.getElementById('closeShareModalBtn').addEventListener('click', () => {
        document.getElementById('shareModal').classList.remove('open');
    });
    
    document.getElementById('closeSavedWheelsBtn').addEventListener('click', () => {
        document.getElementById('savedWheelsModal').classList.remove('open');
    });
    document.getElementById('closeSavedWheelsBtn2').addEventListener('click', () => {
        document.getElementById('savedWheelsModal').classList.remove('open');
    });
    
    // Copy Share Link handler
    document.getElementById('copyShareUrlBtn').addEventListener('click', () => {
        const input = document.getElementById('shareUrlInput');
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            document.getElementById('shareSuccessMsg').style.display = 'block';
        }).catch(e => {
            console.error("Failed to copy link:", e);
        });
    });
    
    // Volume mute toggle
    document.getElementById('volumeToggleBtn').addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        saveState();
        initAudioVolume();
    });
    
    // Theme switch toggle
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        saveState();
        initTheme();
    });
    
    // 5. Customize tabs inside modal
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const panels = document.querySelectorAll('.customize-tab-content .tab-panel');
            panels.forEach(p => p.classList.remove('active'));
            
            const targetId = tab.dataset.target;
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    const spinDurRange = document.getElementById('spinDurationRange');
    spinDurRange.addEventListener('input', (e) => {
        document.getElementById('spinDurationVal').textContent = e.target.value;
    });
    
    const maxNamesRange = document.getElementById('maxNamesRange');
    maxNamesRange.addEventListener('input', (e) => {
        document.getElementById('maxNamesVal').textContent = e.target.value;
    });
    
    const presetSelect = document.getElementById('presetPaletteSelect');
    presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        togglePalettePickerGroup(val === 'custom');
        if (val !== 'custom') {
            const tempColors = [...PALETTES[val]];
            renderCustomPalettePickers(tempColors);
        } else {
            const wheel = getActiveWheel();
            renderCustomPalettePickers(wheel.colors);
        }
    });
    
    document.getElementById('addColorBtn').addEventListener('click', () => {
        const pickers = document.querySelectorAll('#colorPickersList input[type="color"]');
        const colors = Array.from(pickers).map(p => p.value);
        colors.push('#ffffff');
        renderCustomPalettePickers(colors);
    });
    
    const centerSelect = document.getElementById('centerTypeSelect');
    centerSelect.addEventListener('change', (e) => {
        toggleHubOptions(e.target.value);
    });
    
    const hubImgInput = document.getElementById('centerImageInput');
    hubImgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const wheel = getActiveWheel();
            wheel.settings.centerImage = base64;
            
            const preview = document.getElementById('hubImagePreviewContainer');
            preview.innerHTML = `<img src="${base64}" class="hub-image-preview">`;
        };
        reader.readAsDataURL(file);
    });
    
    // 6. Setup new modular features
    setupQuickFill();
    setupTeamGenerator();
    
    // Responsive redraw
    window.addEventListener('resize', () => {
        drawAllWheels();
    });
}
