// MixLab - Music Mixing Laboratory
// Global Variables
let tracks = [];
let audioContext;
let masterGainNode;
let currentModal = null;
let soloMode = false;

// DOM Elements
const uploadZoneSection = document.getElementById('uploadZoneSection');
const labInterface = document.getElementById('labInterface');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const addSlotBtn = document.getElementById('addSlotBtn');
const slotsContainer = document.getElementById('slotsContainer');
const consoleTracks = document.getElementById('consoleTracks');
const masterVolume = document.getElementById('masterVolume');
const masterVolumeValue = document.getElementById('masterVolumeValue');
const playAllBtn = document.getElementById('playAllBtn');
const stopAllBtn = document.getElementById('stopAllBtn');
const soloModeBtn = document.getElementById('soloModeBtn');
const exportBtn = document.getElementById('exportBtn');
const trackModal = document.getElementById('trackModal');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const removeTrackBtn = document.getElementById('removeTrackBtn');
const applySettingsBtn = document.getElementById('applySettingsBtn');
const toast = document.getElementById('toast');
const masterVisualizer = document.getElementById('masterVisualizer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeAudio();
    setupEventListeners();
    createParticles();
    setupVisualizer();
});

// Initialize Audio Context
function initializeAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGainNode = audioContext.createGain();
    masterGainNode.connect(audioContext.destination);
    masterGainNode.gain.value = 0.8;
}

// Create Floating Particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 4 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = 'rgba(108, 92, 231, 0.3)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `float ${Math.random() * 10 + 10}s linear infinite`;
        particle.style.animationDelay = Math.random() * 5 + 's';
        particlesContainer.appendChild(particle);
    }
    
    // Add float animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0% { transform: translate(0, 0); opacity: 0.3; }
            50% { transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px); opacity: 0.6; }
            100% { transform: translate(0, 0); opacity: 0.3; }
        }
    `;
    document.head.appendChild(style);
}

// Setup Event Listeners
function setupEventListeners() {
    // File Upload
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and Drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Add Slot
    addSlotBtn.addEventListener('click', () => fileInput.click());
    
    // Master Controls
    masterVolume.addEventListener('input', (e) => {
        const value = e.target.value;
        masterVolumeValue.textContent = value + '%';
        masterGainNode.gain.value = value / 100;
    });
    
    playAllBtn.addEventListener('click', playAll);
    stopAllBtn.addEventListener('click', stopAll);
    soloModeBtn.addEventListener('click', toggleSoloMode);
    exportBtn.addEventListener('click', exportMix);
    
    // Modal
    closeModal.addEventListener('click', closeTrackModal);
    modalOverlay.addEventListener('click', closeTrackModal);
    applySettingsBtn.addEventListener('click', applyModalSettings);
    removeTrackBtn.addEventListener('click', removeCurrentTrack);
}

// File Handling
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
    fileInput.value = ''; // Reset input
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('audio/')
    );
    
    if (files.length > 0) {
        processFiles(files);
    } else {
        showToast('⚠️', 'Please drop audio files only');
    }
}

// Process Audio Files
function processFiles(files) {
    files.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            audioContext.decodeAudioData(e.target.result, (buffer) => {
                addTrack(file.name, buffer);
            }, (error) => {
                console.error('Error decoding audio:', error);
                showToast('❌', `Failed to load: ${file.name}`);
            });
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Add Track
function addTrack(name, buffer) {
    const track = {
        id: Date.now() + Math.random(),
        name: name.replace(/\.[^/.]+$/, ""),
        buffer: buffer,
        duration: buffer.duration,
        source: null,
        gainNode: null,
        panNode: null,
        isPlaying: false,
        volume: 100,
        pan: 0,
        rate: 1,
        startTime: 0,
        pauseTime: 0
    };
    
    // Create audio nodes
    track.gainNode = audioContext.createGain();
    track.panNode = audioContext.createStereoPanner();
    
    track.gainNode.connect(track.panNode);
    track.panNode.connect(masterGainNode);
    
    tracks.push(track);
    
    // Show lab interface if first track
    if (tracks.length === 1) {
        uploadZoneSection.style.display = 'none';
        labInterface.classList.add('active');
    }
    
    renderTracks();
    showToast('✅', `Added: ${track.name}`);
    
    if (tracks.length >= 2) {
        exportBtn.disabled = false;
    }
}

// Render Tracks
function renderTracks() {
    // Render slots
    slotsContainer.innerHTML = '';
    tracks.forEach(track => {
        const slot = document.createElement('div');
        slot.className = 'track-slot active';
        slot.innerHTML = `
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-duration">${formatTime(track.duration)}</div>
                <div class="track-controls">
                    <button class="track-btn play-track-btn" data-id="${track.id}">
                        ${track.isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button class="track-btn" data-id="${track.id}" onclick="openTrackModal('${track.id}')">⚙️</button>
                </div>
            </div>
        `;
        slotsContainer.appendChild(slot);
    });
    
    // Add play button listeners
    document.querySelectorAll('.play-track-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = parseFloat(btn.dataset.id);
            toggleTrack(trackId);
        });
    });
    
    // Render console
    consoleTracks.innerHTML = '';
    tracks.forEach(track => {
        const consoleTrack = document.createElement('div');
        consoleTrack.className = 'console-track';
        consoleTrack.innerHTML = `
            <div class="console-track-name">${track.name}</div>
            <div class="console-controls">
                <div class="control-group">
                    <label class="control-label">Volume</label>
                    <div class="slider-container">
                        <input type="range" class="slider" data-id="${track.id}" data-control="volume" min="0" max="100" value="${track.volume}">
                        <span class="slider-value">${track.volume}%</span>
                    </div>
                </div>
                <div class="control-group">
                    <label class="control-label">Pan</label>
                    <div class="slider-container">
                        <input type="range" class="slider" data-id="${track.id}" data-control="pan" min="-100" max="100" value="${track.pan}">
                        <span class="slider-value">${getPanLabel(track.pan)}</span>
                    </div>
                </div>
                <div class="control-group">
                    <label class="control-label">Rate</label>
                    <div class="slider-container">
                        <input type="range" class="slider" data-id="${track.id}" data-control="rate" min="50" max="200" value="${track.rate * 100}">
                        <span class="slider-value">${track.rate * 100}%</span>
                    </div>
                </div>
            </div>
        `;
        consoleTracks.appendChild(consoleTrack);
    });
    
    // Add console control listeners
    document.querySelectorAll('.console-track .slider').forEach(slider => {
        slider.addEventListener('input', handleConsoleControl);
    });
}

// Handle Console Controls
function handleConsoleControl(e) {
    const trackId = parseFloat(e.target.dataset.id);
    const control = e.target.dataset.control;
    const value = parseFloat(e.target.value);
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) return;
    
    const valueSpan = e.target.parentElement.querySelector('.slider-value');
    
    switch(control) {
        case 'volume':
            track.volume = value;
            track.gainNode.gain.value = value / 100;
            valueSpan.textContent = value + '%';
            break;
        case 'pan':
            track.pan = value;
            track.panNode.pan.value = value / 100;
            valueSpan.textContent = getPanLabel(value);
            break;
        case 'rate':
            track.rate = value / 100;
            if (track.source) {
                track.source.playbackRate.value = track.rate;
            }
            valueSpan.textContent = value + '%';
            break;
    }
}

function getPanLabel(value) {
    if (value === 0) return 'Center';
    if (value < 0) return `L ${Math.abs(value)}`;
    return `R ${value}`;
}

// Track Playback
function toggleTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    if (track.isPlaying) {
        pauseTrack(track);
    } else {
        playTrack(track);
    }
    
    renderTracks();
}

function playTrack(track) {
    // Stop existing source if any
    if (track.source) {
        track.source.stop();
    }
    
    // Create new source
    track.source = audioContext.createBufferSource();
    track.source.buffer = track.buffer;
    track.source.playbackRate.value = track.rate;
    track.source.connect(track.gainNode);
    
    // Resume from pause point
    const offset = track.pauseTime;
    track.source.start(0, offset);
    track.startTime = audioContext.currentTime - offset;
    track.isPlaying = true;
    
    track.source.onended = () => {
        if (track.isPlaying) {
            track.isPlaying = false;
            track.pauseTime = 0;
            track.source = null;
            renderTracks();
        }
    };
}

function pauseTrack(track) {
    if (track.source) {
        track.pauseTime = audioContext.currentTime - track.startTime;
        track.source.stop();
        track.source = null;
    }
    track.isPlaying = false;
}

function playAll() {
    tracks.forEach(track => {
        if (!track.isPlaying) {
            playTrack(track);
        }
    });
    renderTracks();
    showToast('▶️', 'Playing all tracks');
}

function stopAll() {
    tracks.forEach(track => {
        if (track.isPlaying) {
            pauseTrack(track);
        }
        track.pauseTime = 0;
    });
    renderTracks();
    showToast('⏹️', 'Stopped all tracks');
}

function toggleSoloMode() {
    soloMode = !soloMode;
    soloModeBtn.classList.toggle('active');
    showToast('🎧', soloMode ? 'Solo mode ON' : 'Solo mode OFF');
}

// Track Modal
function openTrackModal(trackId) {
    const track = tracks.find(t => t.id === parseFloat(trackId));
    if (!track) return;
    
    currentModal = track;
    
    document.getElementById('modalTrackName').textContent = track.name;
    document.getElementById('modalDuration').textContent = formatTime(track.duration);
    
    const modalVolume = document.getElementById('modalVolume');
    const modalPan = document.getElementById('modalPan');
    const modalRate = document.getElementById('modalRate');
    
    modalVolume.value = track.volume;
    modalPan.value = track.pan;
    modalRate.value = track.rate * 100;
    
    document.getElementById('modalVolumeValue').textContent = track.volume + '%';
    document.getElementById('modalPanValue').textContent = getPanLabel(track.pan);
    document.getElementById('modalRateValue').textContent = (track.rate * 100) + '%';
    
    // Add listeners
    modalVolume.oninput = (e) => {
        document.getElementById('modalVolumeValue').textContent = e.target.value + '%';
    };
    modalPan.oninput = (e) => {
        document.getElementById('modalPanValue').textContent = getPanLabel(e.target.value);
    };
    modalRate.oninput = (e) => {
        document.getElementById('modalRateValue').textContent = e.target.value + '%';
    };
    
    trackModal.classList.add('active');
}

window.openTrackModal = openTrackModal;

function closeTrackModal() {
    trackModal.classList.remove('active');
    currentModal = null;
}

function applyModalSettings() {
    if (!currentModal) return;
    
    const modalVolume = document.getElementById('modalVolume');
    const modalPan = document.getElementById('modalPan');
    const modalRate = document.getElementById('modalRate');
    
    currentModal.volume = parseFloat(modalVolume.value);
    currentModal.pan = parseFloat(modalPan.value);
    currentModal.rate = parseFloat(modalRate.value) / 100;
    
    currentModal.gainNode.gain.value = currentModal.volume / 100;
    currentModal.panNode.pan.value = currentModal.pan / 100;
    
    if (currentModal.source) {
        currentModal.source.playbackRate.value = currentModal.rate;
    }
    
    renderTracks();
    closeTrackModal();
    showToast('✅', 'Settings applied');
}

function removeCurrentTrack() {
    if (!currentModal) return;
    
    const trackIndex = tracks.findIndex(t => t.id === currentModal.id);
    if (trackIndex === -1) return;
    
    // Stop if playing
    if (currentModal.isPlaying) {
        pauseTrack(currentModal);
    }
    
    // Remove from array
    tracks.splice(trackIndex, 1);
    
    // Check if need to show upload screen
    if (tracks.length === 0) {
        labInterface.classList.remove('active');
        uploadZoneSection.style.display = 'flex';
        exportBtn.disabled = true;
    } else {
        renderTracks();
        if (tracks.length < 2) {
            exportBtn.disabled = true;
        }
    }
    
    closeTrackModal();
    showToast('🗑️', 'Track removed');
}

// Export Mix
function exportMix() {
    showToast('💾', 'Mix export feature coming soon!');
    // In a real implementation, this would record the mixed audio
}

// Visualizer
function setupVisualizer() {
    const canvas = masterVisualizer;
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    
    resize();
    window.addEventListener('resize', resize);
    
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw some animated bars
        const barCount = 32;
        const barWidth = canvas.width / barCount;
        
        for (let i = 0; i < barCount; i++) {
            const height = Math.random() * canvas.height * 0.8;
            const hue = (i / barCount) * 360;
            
            ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.6)`;
            ctx.fillRect(
                i * barWidth,
                canvas.height - height,
                barWidth - 2,
                height
            );
        }
        
        requestAnimationFrame(draw);
    }
    
    draw();
}

// Toast Notification
function showToast(icon, message) {
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    
    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Utility
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        if (tracks.length > 0) {
            const anyPlaying = tracks.some(t => t.isPlaying);
            if (anyPlaying) {
                stopAll();
            } else {
                playAll();
            }
        }
    }
});

console.log('🧪 MixLab initialized - Ready to mix!');
