// SpinForm - Music Player JavaScript

// Global Variables
let audioContext;
let currentTrack = null;
let playlist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let selectedFormat = 'vinyl';

// DOM Elements
const uploadModal = document.getElementById('uploadModal');
const uploadBtn = document.getElementById('uploadBtn');
const heroUploadBtn = document.getElementById('heroUploadBtn');
const closeModal = document.getElementById('closeModal');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const fileList = document.getElementById('fileList');
const startPlayingBtn = document.getElementById('startPlayingBtn');
const playerSection = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const mainPlayBtn = document.getElementById('mainPlayBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const closePlayer = document.getElementById('closePlayer');
const progressFill = document.getElementById('progressFill');
const progressHandle = document.getElementById('progressHandle');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const volumeSlider = document.getElementById('volumeSlider');
const trackName = document.getElementById('trackName');
const artistName = document.getElementById('artistName');
const customizeBtn = document.getElementById('customizeBtn');
const customizationSidebar = document.getElementById('customizationSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const exploreBtn = document.getElementById('exploreBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDustParticles();
    initializeGrooves();
    setupEventListeners();
    setupGalleryFilters();
});

// Create floating dust particles
function initializeDustParticles() {
    const dustContainer = document.getElementById('dustContainer');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'dust-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        dustContainer.appendChild(particle);
    }
}

// Create vinyl grooves
function initializeGrooves() {
    const groovesContainer = document.getElementById('grooves');
    const grooveCount = 30;

    for (let i = 0; i < grooveCount; i++) {
        const groove = document.createElement('div');
        groove.className = 'groove';
        const size = 50 + (i * 8);
        groove.style.width = size + 'px';
        groove.style.height = size + 'px';
        groovesContainer.appendChild(groove);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Upload Modal
    uploadBtn.addEventListener('click', () => openUploadModal());
    heroUploadBtn.addEventListener('click', () => openUploadModal());
    closeModal.addEventListener('click', () => closeUploadModal());
    
    // Click outside to close
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            closeUploadModal();
        }
    });

    // File Upload
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and Drop
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    
    // Format Selection
    const formatRadios = document.querySelectorAll('input[name="format"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedFormat = e.target.value;
        });
    });
    
    // Start Playing
    startPlayingBtn.addEventListener('click', startPlaying);
    
    // Player Controls
    mainPlayBtn.addEventListener('click', togglePlay);
    playPauseBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    shuffleBtn.addEventListener('click', shufflePlaylist);
    closePlayer.addEventListener('click', closePlayerSection);
    
    // Audio Player Events
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    
    // Volume Control
    volumeSlider.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value / 100;
    });
    
    // Progress Bar
    const progressBar = document.querySelector('.progress-bar');
    progressBar.addEventListener('click', seekTo);
    
    // Customization
    customizeBtn.addEventListener('click', () => {
        customizationSidebar.classList.add('active');
    });
    
    closeSidebar.addEventListener('click', () => {
        customizationSidebar.classList.remove('active');
    });
    
    // Color Selection
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            changeVinylColor(btn.dataset.color);
        });
    });
    
    // Label Text
    const labelTextInput = document.getElementById('labelText');
    labelTextInput.addEventListener('input', (e) => {
        updateLabelText(e.target.value);
    });
    
    // Wear Slider
    const wearSlider = document.getElementById('wearSlider');
    wearSlider.addEventListener('input', (e) => {
        document.querySelector('.slider-value').textContent = e.target.value + '%';
        applyWear(e.target.value);
    });
    
    // Audio Effects
    document.getElementById('crackleToggle').addEventListener('change', toggleCrackle);
    document.getElementById('motorToggle').addEventListener('change', toggleMotor);
    
    // Cover Art Upload
    const uploadCoverBtn = document.getElementById('uploadCoverBtn');
    const coverArtInput = document.getElementById('coverArtInput');
    
    uploadCoverBtn.addEventListener('click', () => coverArtInput.click());
    coverArtInput.addEventListener('change', handleCoverArtUpload);
    
    // Explore Gallery
    exploreBtn.addEventListener('click', () => {
        document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Format Cards
    const formatCards = document.querySelectorAll('.format-card');
    formatCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedFormat = card.dataset.format;
            showFormatDemo(selectedFormat);
        });
    });
}

// Upload Modal Functions
function openUploadModal() {
    uploadModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
    uploadModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// File Handling
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFilesToPlaylist(files);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    addFilesToPlaylist(audioFiles);
}

function addFilesToPlaylist(files) {
    files.forEach(file => {
        if (file.type.startsWith('audio/')) {
            playlist.push({
                file: file,
                name: file.name.replace(/\.[^/.]+$/, ""),
                url: URL.createObjectURL(file)
            });
        }
    });
    
    updateFileList();
    
    if (playlist.length > 0) {
        startPlayingBtn.disabled = false;
    }
}

function updateFileList() {
    fileList.innerHTML = '';
    
    playlist.forEach((track, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-item-name">${track.name}</span>
            <button class="file-item-remove" onclick="removeTrack(${index})">×</button>
        `;
        fileList.appendChild(fileItem);
    });
}

function removeTrack(index) {
    URL.revokeObjectURL(playlist[index].url);
    playlist.splice(index, 1);
    updateFileList();
    
    if (playlist.length === 0) {
        startPlayingBtn.disabled = true;
    }
}

// Player Functions
function startPlaying() {
    if (playlist.length === 0) return;
    
    closeUploadModal();
    playerSection.classList.add('active');
    
    // Scroll to player
    setTimeout(() => {
        playerSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    loadTrack(0);
}

function loadTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    
    currentTrackIndex = index;
    currentTrack = playlist[index];
    
    audioPlayer.src = currentTrack.url;
    trackName.textContent = currentTrack.name;
    artistName.textContent = 'SpinForm Player';
    
    // Update album art
    const albumArt = document.getElementById('albumArt');
    albumArt.textContent = getFormatIcon(selectedFormat);
    
    if (isPlaying) {
        audioPlayer.play();
    }
}

function getFormatIcon(format) {
    const icons = {
        vinyl: '💿',
        cassette: '📼',
        cd: '💽',
        '8track': '🎵',
        minidisc: '💾',
        reel: '🎞️'
    };
    return icons[format] || '🎵';
}

function togglePlay() {
    if (!currentTrack) {
        if (playlist.length > 0) {
            loadTrack(0);
        } else {
            return;
        }
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        mainPlayBtn.textContent = '▶';
        playPauseBtn.textContent = '▶';
        document.querySelector('.player-vinyl-record').classList.add('paused');
        document.querySelector('.player-tonearm').classList.remove('playing');
    } else {
        audioPlayer.play();
        isPlaying = true;
        mainPlayBtn.textContent = '⏸';
        playPauseBtn.textContent = '⏸';
        document.querySelector('.player-vinyl-record').classList.remove('paused');
        document.querySelector('.player-tonearm').classList.add('playing');
    }
}

function playPrevious() {
    if (currentTrackIndex > 0) {
        loadTrack(currentTrackIndex - 1);
        if (isPlaying) {
            audioPlayer.play();
        }
    }
}

function playNext() {
    if (currentTrackIndex < playlist.length - 1) {
        loadTrack(currentTrackIndex + 1);
        if (isPlaying) {
            audioPlayer.play();
        }
    } else {
        // Loop back to first track
        loadTrack(0);
        if (isPlaying) {
            audioPlayer.play();
        }
    }
}

function shufflePlaylist() {
    for (let i = playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }
    
    loadTrack(0);
    updateFileList();
    
    // Visual feedback
    shuffleBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        shuffleBtn.style.transform = 'rotate(0deg)';
    }, 500);
}

function closePlayerSection() {
    playerSection.classList.remove('active');
    audioPlayer.pause();
    isPlaying = false;
    mainPlayBtn.textContent = '▶';
    playPauseBtn.textContent = '▶';
}

// Progress and Time
function updateProgress() {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressFill.style.width = progress + '%';
    progressHandle.style.left = progress + '%';
    
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
}

function updateDuration() {
    totalTimeEl.textContent = formatTime(audioPlayer.duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekTo(e) {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pos * audioPlayer.duration;
}

// Customization Functions
function changeVinylColor(color) {
    const vinylRecord = document.querySelector('.player-vinyl-record');
    
    const colorGradients = {
        black: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #0a0a0a 50%, #000000 100%)',
        red: 'radial-gradient(circle at 30% 30%, #ff6b6b 0%, #ff3b3b 50%, #cc0000 100%)',
        blue: 'radial-gradient(circle at 30% 30%, #6b8fff 0%, #3b5bff 50%, #0033cc 100%)',
        purple: 'radial-gradient(circle at 30% 30%, #c06bff 0%, #a03bff 50%, #7700cc 100%)',
        clear: 'radial-gradient(circle at 30% 30%, rgba(240, 240, 240, 0.3) 0%, rgba(200, 200, 200, 0.3) 50%, rgba(160, 160, 160, 0.3) 100%)'
    };
    
    vinylRecord.style.background = colorGradients[color];
}

function updateLabelText(text) {
    const labels = document.querySelectorAll('.vinyl-label, .player-vinyl-label');
    labels.forEach(label => {
        // Only update text labels, not icon labels
        if (!label.querySelector('span')) {
            label.textContent = text || 'SPINFORM RECORDS';
        }
    });
}

function applyWear(value) {
    const vinylRecord = document.querySelector('.player-vinyl-record');
    const opacity = value / 200; // Max 50% opacity for wear effect
    
    // Add scratches and dust
    vinylRecord.style.boxShadow = `
        inset 0 0 100px rgba(0, 0, 0, ${0.8 + opacity}),
        0 10px 40px rgba(0, 0, 0, 0.9),
        inset 0 0 0 2px rgba(255, 255, 255, ${0.03 + opacity})
    `;
}

function toggleCrackle(e) {
    // In a real implementation, this would add/remove crackle audio effect
    console.log('Vinyl crackle:', e.target.checked ? 'ON' : 'OFF');
    
    if (e.target.checked) {
        // Add subtle crackle sound effect
        showNotification('Vinyl crackle enabled');
    } else {
        showNotification('Vinyl crackle disabled');
    }
}

function toggleMotor(e) {
    // In a real implementation, this would add/remove motor hum
    console.log('Motor hum:', e.target.checked ? 'ON' : 'OFF');
    
    if (e.target.checked) {
        showNotification('Motor hum enabled');
    } else {
        showNotification('Motor hum disabled');
    }
}

function handleCoverArtUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const albumArt = document.getElementById('albumArt');
            albumArt.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            showNotification('Cover art updated');
        };
        
        reader.readAsDataURL(file);
    }
}

// Gallery Filters
function setupGalleryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter items
            galleryItems.forEach(item => {
                if (filter === 'all' || item.dataset.format === filter) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
    
    // Gallery item click
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const format = item.dataset.format;
            showNotification(`Opening ${format} player...`);
        });
    });
}

// Format Demo
function showFormatDemo(format) {
    showNotification(`Loading ${format} player...`);
    
    // Scroll to features or player section
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

// Notification System
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: linear-gradient(135deg, var(--accent-gold), #ffd700);
        color: var(--bg-primary);
        padding: 1rem 2rem;
        border-radius: 8px;
        font-family: 'IBM Plex Mono', monospace;
        font-weight: 600;
        z-index: 3000;
        box-shadow: 0 10px 30px rgba(212, 175, 55, 0.4);
        animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Space bar to play/pause
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
    }
    
    // Arrow keys for next/previous
    if (e.code === 'ArrowRight') {
        playNext();
    }
    
    if (e.code === 'ArrowLeft') {
        playPrevious();
    }
    
    // Escape to close modals/sidebars
    if (e.code === 'Escape') {
        closeUploadModal();
        customizationSidebar.classList.remove('active');
    }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Initialize audio context on first user interaction
document.addEventListener('click', () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}, { once: true });

// Export Functions (for sharing and export features)
function generateShareableLink() {
    // In a real implementation, this would generate a unique URL
    const link = `https://spinform.app/player/${Date.now()}`;
    
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Link copied to clipboard!');
    });
}

function exportVideo() {
    showNotification('Preparing video export... This may take a moment.');
    
    // In a real implementation, this would use canvas recording
    setTimeout(() => {
        showNotification('Video export ready for download!');
    }, 2000);
}

// Add export button listeners
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        showNotification('Export options coming soon!');
    });
}

// Console welcome message
console.log('%c🎵 SpinForm ', 'font-size: 20px; font-weight: bold; color: #d4af37;');
console.log('%cMusic, made physical again.', 'font-size: 14px; color: #a0a0a0;');
console.log('Built with love for music and nostalgia.');
