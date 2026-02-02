// MixLab - Fully Functional Music Mixing Laboratory

// Global State
const state = {
    tracks: [],
    audioContext: null,
    masterGainNode: null,
    analyser: null,
    isInitialized: false,
    currentModalTrack: null,
    animationId: null
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🧪 MixLab initializing...');
    setupEventListeners();
    createParticles();
});

// Initialize Audio Context (on first user interaction)
function initAudioContext() {
    if (state.isInitialized) return;
    
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.masterGainNode = state.audioContext.createGain();
        state.masterGainNode.gain.value = 0.8;
        
        // Create analyser for visualization
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 256;
        
        state.masterGainNode.connect(state.analyser);
        state.analyser.connect(state.audioContext.destination);
        
        state.isInitialized = true;
        console.log('✅ Audio context initialized');
        
        startVisualization();
        updateStatus('Mixing Active');
    } catch (error) {
        console.error('Failed to initialize audio context:', error);
        showToast('❌', 'Failed to initialize audio system');
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // File upload
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const addMoreBtn = document.getElementById('addMoreBtn');
    
    browseBtn.addEventListener('click', () => {
        initAudioContext();
        fileInput.click();
    });
    
    addMoreBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('.drop-zone-content')) {
            initAudioContext();
            fileInput.click();
        }
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        initAudioContext();
        handleDrop(e);
    });
    
    // Master controls
    const masterVolume = document.getElementById('masterVolume');
    const playAllBtn = document.getElementById('playAllBtn');
    const pauseAllBtn = document.getElementById('pauseAllBtn');
    const stopAllBtn = document.getElementById('stopAllBtn');
    
    masterVolume.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        if (state.masterGainNode) {
            state.masterGainNode.gain.value = value;
        }
        document.getElementById('masterVolumeValue').textContent = e.target.value + '%';
    });
    
    playAllBtn.addEventListener('click', playAllTracks);
    pauseAllBtn.addEventListener('click', pauseAllTracks);
    stopAllBtn.addEventListener('click', stopAllTracks);
    
    // Modal controls
    const closeModal = document.getElementById('closeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const removeTrackBtn = document.getElementById('removeTrackBtn');
    
    closeModal.addEventListener('click', closeTrackModal);
    closeModalBtn.addEventListener('click', closeTrackModal);
    modalOverlay.addEventListener('click', closeTrackModal);
    removeTrackBtn.addEventListener('click', removeCurrentTrack);
    
    // Modal sliders
    setupModalControls();
}

// Setup Modal Controls
function setupModalControls() {
    const modalVolume = document.getElementById('modalVolume');
    const modalPan = document.getElementById('modalPan');
    const modalRate = document.getElementById('modalRate');
    const modalLoop = document.getElementById('modalLoop');
    
    modalVolume.addEventListener('input', (e) => {
        document.getElementById('modalVolumeDisplay').textContent = e.target.value + '%';
        if (state.currentModalTrack) {
            state.currentModalTrack.volume = parseInt(e.target.value);
            state.currentModalTrack.gainNode.gain.value = e.target.value / 100;
        }
    });
    
    modalPan.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        const label = value === 0 ? 'Center' : value < 0 ? `L${Math.abs(value)}` : `R${value}`;
        document.getElementById('modalPanDisplay').textContent = label;
        if (state.currentModalTrack && state.currentModalTrack.panNode) {
            state.currentModalTrack.pan = value;
            state.currentModalTrack.panNode.pan.value = value / 100;
        }
    });
    
    modalRate.addEventListener('input', (e) => {
        const rate = e.target.value / 100;
        document.getElementById('modalRateDisplay').textContent = rate.toFixed(2) + 'x';
        if (state.currentModalTrack) {
            state.currentModalTrack.playbackRate = rate;
            if (state.currentModalTrack.source) {
                state.currentModalTrack.source.playbackRate.value = rate;
            }
        }
    });
    
    modalLoop.addEventListener('change', (e) => {
        if (state.currentModalTrack) {
            state.currentModalTrack.loop = e.target.checked;
            if (state.currentModalTrack.source) {
                state.currentModalTrack.source.loop = e.target.checked;
            }
        }
    });
}

// File Handling
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

function handleDrop(e) {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) {
        showToast('⚠️', 'Please drop audio files only');
        return;
    }
    processFiles(files);
}

// Process Files
function processFiles(files) {
    showLoadingModal('Processing audio files...');
    
    let processed = 0;
    const total = files.length;
    
    files.forEach((file) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            state.audioContext.decodeAudioData(
                e.target.result,
                (buffer) => {
                    addTrack(file.name, buffer);
                    processed++;
                    if (processed === total) {
                        hideLoadingModal();
                        showToast('✅', `Added ${total} track${total > 1 ? 's' : ''}`);
                    }
                },
                (error) => {
                    console.error('Decode error:', error);
                    processed++;
                    showToast('❌', `Failed to load: ${file.name}`);
                    if (processed === total) {
                        hideLoadingModal();
                    }
                }
            );
        };
        
        reader.onerror = () => {
            processed++;
            showToast('❌', `Error reading: ${file.name}`);
            if (processed === total) {
                hideLoadingModal();
            }
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Add Track
function addTrack(filename, buffer) {
    const track = {
        id: Date.now() + Math.random(),
        name: filename.replace(/\.[^/.]+$/, ''),
        buffer: buffer,
        duration: buffer.duration,
        source: null,
        gainNode: null,
        panNode: null,
        isPlaying: false,
        isPaused: false,
        volume: 100,
        pan: 0,
        playbackRate: 1,
        loop: false,
        startTime: 0,
        pauseOffset: 0
    };
    
    // Create audio nodes
    track.gainNode = state.audioContext.createGain();
    track.gainNode.gain.value = 1;
    
    track.panNode = state.audioContext.createStereoPanner();
    track.panNode.pan.value = 0;
    
    // Connect: gain -> pan -> master
    track.gainNode.connect(track.panNode);
    track.panNode.connect(state.masterGainNode);
    
    state.tracks.push(track);
    
    // Show interface if first track
    if (state.tracks.length === 1) {
        document.getElementById('uploadZoneSection').style.display = 'none';
        document.getElementById('labInterface').classList.add('active');
    }
    
    renderUI();
}

// Render UI
function renderUI() {
    renderTrackSlots();
    renderConsole();
    updateTrackCount();
}

function updateTrackCount() {
    document.getElementById('trackCount').textContent = state.tracks.length;
}

function renderTrackSlots() {
    const container = document.getElementById('slotsContainer');
    container.innerHTML = '';
    
    state.tracks.forEach(track => {
        const slot = document.createElement('div');
        slot.className = 'track-slot' + (track.isPlaying ? ' playing' : '');
        slot.innerHTML = `
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-duration">${formatTime(track.duration)}</div>
                <div class="track-status ${track.isPlaying ? '' : 'paused'}">
                    ${track.isPlaying ? '▶ Playing' : '⏸ Paused'}
                </div>
                <div class="track-controls">
                    <button class="track-btn" onclick="toggleTrack('${track.id}')" title="${track.isPlaying ? 'Pause' : 'Play'}">
                        ${track.isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button class="track-btn" onclick="stopTrack('${track.id}')" title="Stop">
                        ⏹️
                    </button>
                    <button class="track-btn" onclick="openTrackSettings('${track.id}')" title="Settings">
                        ⚙️
                    </button>
                </div>
            </div>
        `;
        container.appendChild(slot);
    });
}

function renderConsole() {
    const container = document.getElementById('consoleTracks');
    container.innerHTML = '';
    
    state.tracks.forEach(track => {
        const consoleTrack = document.createElement('div');
        consoleTrack.className = 'console-track';
        consoleTrack.innerHTML = `
            <div class="console-track-header">
                <div class="console-track-name">${track.name}</div>
            </div>
            <div class="console-controls">
                <div class="control-group">
                    <label class="control-label">Volume</label>
                    <div class="slider-container">
                        <input type="range" class="slider" min="0" max="100" value="${track.volume}" 
                               onchange="updateTrackVolume('${track.id}', this.value)">
                        <span class="slider-value" id="vol-${track.id}">${track.volume}%</span>
                    </div>
                </div>
                <div class="control-group">
                    <label class="control-label">Pan (L/R)</label>
                    <div class="slider-container">
                        <input type="range" class="slider" min="-100" max="100" value="${track.pan}"
                               onchange="updateTrackPan('${track.id}', this.value)">
                        <span class="slider-value" id="pan-${track.id}">${formatPan(track.pan)}</span>
                    </div>
                </div>
                <div class="control-group">
                    <label class="control-label">Speed</label>
                    <div class="slider-container">
                        <input type="range" class="slider" min="25" max="200" value="${track.playbackRate * 100}" step="25"
                               onchange="updateTrackRate('${track.id}', this.value)">
                        <span class="slider-value" id="rate-${track.id}">${track.playbackRate.toFixed(2)}x</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(consoleTrack);
    });
}

// Track Control Functions (exposed globally)
window.toggleTrack = function(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    
    if (track.isPlaying) {
        pauseTrack(track);
    } else {
        playTrack(track);
    }
    renderUI();
};

window.stopTrack = function(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    
    if (track.source) {
        track.source.stop();
        track.source.disconnect();
        track.source = null;
    }
    
    track.isPlaying = false;
    track.isPaused = false;
    track.pauseOffset = 0;
    track.startTime = 0;
    
    renderUI();
    showToast('⏹️', `Stopped: ${track.name}`);
};

window.openTrackSettings = function(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    
    state.currentModalTrack = track;
    
    // Update modal content
    document.getElementById('modalTrackName').textContent = track.name;
    document.getElementById('modalDuration').textContent = formatTime(track.duration);
    document.getElementById('modalStatus').textContent = track.isPlaying ? 'Playing' : 'Stopped';
    
    document.getElementById('modalVolume').value = track.volume;
    document.getElementById('modalVolumeDisplay').textContent = track.volume + '%';
    
    document.getElementById('modalPan').value = track.pan;
    document.getElementById('modalPanDisplay').textContent = formatPan(track.pan);
    
    document.getElementById('modalRate').value = track.playbackRate * 100;
    document.getElementById('modalRateDisplay').textContent = track.playbackRate.toFixed(2) + 'x';
    
    document.getElementById('modalLoop').checked = track.loop;
    
    document.getElementById('trackModal').classList.add('active');
};

window.updateTrackVolume = function(trackId, value) {
    const track = findTrack(trackId);
    if (!track) return;
    
    track.volume = parseInt(value);
    track.gainNode.gain.value = value / 100;
    document.getElementById(`vol-${trackId}`).textContent = value + '%';
};

window.updateTrackPan = function(trackId, value) {
    const track = findTrack(trackId);
    if (!track) return;
    
    track.pan = parseInt(value);
    track.panNode.pan.value = value / 100;
    document.getElementById(`pan-${trackId}`).textContent = formatPan(value);
};

window.updateTrackRate = function(trackId, value) {
    const track = findTrack(trackId);
    if (!track) return;
    
    const rate = value / 100;
    track.playbackRate = rate;
    if (track.source) {
        track.source.playbackRate.value = rate;
    }
    document.getElementById(`rate-${trackId}`).textContent = rate.toFixed(2) + 'x';
};

// Playback Functions
function playTrack(track) {
    try {
        // Stop existing source
        if (track.source) {
            track.source.stop();
            track.source.disconnect();
        }
        
        // Create new source
        track.source = state.audioContext.createBufferSource();
        track.source.buffer = track.buffer;
        track.source.playbackRate.value = track.playbackRate;
        track.source.loop = track.loop;
        
        // Connect to gain node
        track.source.connect(track.gainNode);
        
        // Calculate offset (for resume from pause)
        const offset = track.pauseOffset;
        track.source.start(0, offset);
        track.startTime = state.audioContext.currentTime - offset;
        track.isPlaying = true;
        track.isPaused = false;
        
        // Handle ended
        track.source.onended = () => {
            if (!track.loop && track.isPlaying) {
                track.isPlaying = false;
                track.pauseOffset = 0;
                track.source = null;
                renderUI();
            }
        };
        
        showToast('▶️', `Playing: ${track.name}`);
    } catch (error) {
        console.error('Play error:', error);
        showToast('❌', 'Failed to play track');
    }
}

function pauseTrack(track) {
    if (!track.source || !track.isPlaying) return;
    
    try {
        const elapsed = state.audioContext.currentTime - track.startTime;
        track.pauseOffset = elapsed % track.buffer.duration;
        
        track.source.stop();
        track.source.disconnect();
        track.source = null;
        
        track.isPlaying = false;
        track.isPaused = true;
        
        showToast('⏸️', `Paused: ${track.name}`);
    } catch (error) {
        console.error('Pause error:', error);
    }
}

function playAllTracks() {
    state.tracks.forEach(track => {
        if (!track.isPlaying) {
            playTrack(track);
        }
    });
    renderUI();
    showToast('▶️', 'Playing all tracks');
}

function pauseAllTracks() {
    state.tracks.forEach(track => {
        if (track.isPlaying) {
            pauseTrack(track);
        }
    });
    renderUI();
    showToast('⏸️', 'Paused all tracks');
}

function stopAllTracks() {
    state.tracks.forEach(track => {
        if (track.source) {
            track.source.stop();
            track.source.disconnect();
            track.source = null;
        }
        track.isPlaying = false;
        track.isPaused = false;
        track.pauseOffset = 0;
        track.startTime = 0;
    });
    renderUI();
    showToast('⏹️', 'Stopped all tracks');
}

// Modal Functions
function closeTrackModal() {
    document.getElementById('trackModal').classList.remove('active');
    state.currentModalTrack = null;
    renderUI();
}

function removeCurrentTrack() {
    if (!state.currentModalTrack) return;
    
    const track = state.currentModalTrack;
    const index = state.tracks.findIndex(t => t.id === track.id);
    
    if (index === -1) return;
    
    // Stop and disconnect
    if (track.source) {
        track.source.stop();
        track.source.disconnect();
    }
    track.gainNode.disconnect();
    track.panNode.disconnect();
    
    // Remove from array
    state.tracks.splice(index, 1);
    
    closeTrackModal();
    
    // Reset if no tracks left
    if (state.tracks.length === 0) {
        document.getElementById('labInterface').classList.remove('active');
        document.getElementById('uploadZoneSection').style.display = 'flex';
        updateStatus('Ready to Mix');
    } else {
        renderUI();
    }
    
    showToast('🗑️', `Removed: ${track.name}`);
}

// Visualization
function startVisualization() {
    const canvas = document.getElementById('masterVisualizer');
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        state.animationId = requestAnimationFrame(draw);
        
        state.analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(15, 20, 25, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = canvas.width / bufferLength;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const hue = (i / bufferLength) * 360;
            
            ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
            ctx.fillRect(
                i * barWidth,
                canvas.height - barHeight,
                barWidth - 1,
                barHeight
            );
        }
    }
    
    draw();
}

// Helper Functions
function findTrack(trackId) {
    return state.tracks.find(t => t.id === parseFloat(trackId));
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatPan(value) {
    const val = parseInt(value);
    if (val === 0) return 'Center';
    if (val < 0) return `L${Math.abs(val)}`;
    return `R${val}`;
}

function updateStatus(text) {
    document.getElementById('statusText').textContent = text;
}

// UI Functions
function showLoadingModal(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').classList.add('active');
}

function hideLoadingModal() {
    document.getElementById('loadingModal').classList.remove('active');
}

function showToast(icon, message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent = icon;
    document.getElementById('toastMessage').textContent = message;
    
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

function createParticles() {
    const container = document.getElementById('particles');
    const count = 20;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(108, 92, 231, 0.3);
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(particle);
    }
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0%, 100% { transform: translate(0, 0); opacity: 0.3; }
            50% { transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px); opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && state.tracks.length > 0) {
        e.preventDefault();
        const anyPlaying = state.tracks.some(t => t.isPlaying);
        if (anyPlaying) {
            pauseAllTracks();
        } else {
            playAllTracks();
        }
    }
});

console.log('🧪 MixLab loaded - Ready to create!');
