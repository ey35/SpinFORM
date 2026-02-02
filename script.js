// ===================================
// STATE MANAGEMENT
// ===================================
const AppState = {
    currentView: 'library',
    musicLibrary: [],
    sharedMusic: [],
    currentTrack: null,
    isPlaying: false,
    currentTrackIndex: -1,
    playlist: []
};

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadFromLocalStorage();
    setupEventListeners();
    renderLibrary();
    updateEmptyStates();
});

function initializeApp() {
    // Add sample data for demonstration
    if (AppState.musicLibrary.length === 0) {
        addSampleData();
    }
}

function addSampleData() {
    const sampleTracks = [
        {
            id: generateId(),
            name: 'Neon Dreams',
            artist: 'Synthwave Collective',
            duration: '3:45',
            size: '5.2 MB',
            dateAdded: new Date().toISOString(),
            emoji: '🌃'
        },
        {
            id: generateId(),
            name: 'Electric Horizon',
            artist: 'Cyber Sound',
            duration: '4:12',
            size: '6.1 MB',
            dateAdded: new Date().toISOString(),
            emoji: '⚡'
        },
        {
            id: generateId(),
            name: 'Digital Paradise',
            artist: 'Future Beats',
            duration: '3:28',
            size: '4.8 MB',
            dateAdded: new Date().toISOString(),
            emoji: '🎮'
        }
    ];
    
    AppState.musicLibrary = sampleTracks;
    saveToLocalStorage();
}

// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    
    // Upload Zone
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        filterLibrary(e.target.value);
    });
    
    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
        sortLibrary(e.target.value);
    });
    
    // Player Controls
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', playPrevious);
    document.getElementById('next-btn').addEventListener('click', playNext);
    
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('loadedmetadata', () => {
        const duration = formatTime(audioPlayer.duration);
        document.getElementById('duration-time').textContent = duration;
    });
    
    // Progress Bar
    const progressSlider = document.getElementById('progress-slider');
    progressSlider.addEventListener('input', (e) => {
        const audioPlayer = document.getElementById('audio-player');
        const time = (e.target.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = time;
    });
    
    // Volume Control
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    
    volumeSlider.addEventListener('input', (e) => {
        const audioPlayer = document.getElementById('audio-player');
        audioPlayer.volume = e.target.value / 100;
        updateVolumeIcon(e.target.value);
    });
    
    volumeBtn.addEventListener('click', toggleMute);
    
    // Initialize volume
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.volume = 0.8;
}

// ===================================
// VIEW SWITCHING
// ===================================
function switchView(viewName) {
    AppState.currentView = viewName;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Render appropriate content
    if (viewName === 'library') {
        renderLibrary();
    } else if (viewName === 'shared') {
        renderShared();
    }
}

// ===================================
// FILE HANDLING
// ===================================
function handleFiles(files) {
    const uploadQueue = document.getElementById('upload-queue');
    
    Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith('audio/')) {
            showToast('Please upload audio files only', 'error');
            return;
        }
        
        const uploadItem = createUploadItem(file);
        uploadQueue.appendChild(uploadItem);
        
        // Simulate upload progress
        setTimeout(() => {
            simulateUpload(file, uploadItem);
        }, index * 200);
    });
}

function createUploadItem(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.innerHTML = `
        <div class="upload-item-info">
            <h4>${file.name}</h4>
            <p>${formatFileSize(file.size)}</p>
            <div class="upload-progress">
                <div class="upload-progress-bar" style="width: 0%"></div>
            </div>
        </div>
    `;
    return item;
}

function simulateUpload(file, uploadItem) {
    const progressBar = uploadItem.querySelector('.upload-progress-bar');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Add to library
            setTimeout(() => {
                addToLibrary(file);
                uploadItem.remove();
                showToast('Track uploaded successfully', 'success');
            }, 500);
        }
        progressBar.style.width = progress + '%';
    }, 300);
}

function addToLibrary(file) {
    const track = {
        id: generateId(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        duration: '0:00',
        size: formatFileSize(file.size),
        dateAdded: new Date().toISOString(),
        emoji: getRandomEmoji(),
        file: file
    };
    
    // If it's a real file, create object URL
    if (file instanceof File) {
        track.url = URL.createObjectURL(file);
    }
    
    AppState.musicLibrary.unshift(track);
    saveToLocalStorage();
    renderLibrary();
    updateEmptyStates();
    
    // Switch to library view
    switchView('library');
}

// ===================================
// LIBRARY RENDERING
// ===================================
function renderLibrary() {
    const grid = document.getElementById('music-grid');
    grid.innerHTML = '';
    
    AppState.musicLibrary.forEach((track, index) => {
        const card = createMusicCard(track, index);
        grid.appendChild(card);
    });
    
    updateEmptyStates();
}

function createMusicCard(track, index) {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.style.animationDelay = `${index * 0.05}s`;
    
    card.innerHTML = `
        <div class="album-cover">
            <span style="font-size: 4rem;">${track.emoji}</span>
        </div>
        <div class="music-info">
            <h3>${track.name}</h3>
            <p>${track.artist}</p>
            <div class="music-meta">
                <span>⏱️ ${track.duration}</span>
                <span>💾 ${track.size}</span>
            </div>
        </div>
        <div class="music-actions">
            <button class="action-btn" onclick="playTrack(${index})">▶️ Play</button>
            <button class="action-btn" onclick="shareTrack('${track.id}')">🔗 Share</button>
            <button class="action-btn" onclick="deleteTrack('${track.id}')">🗑️ Delete</button>
        </div>
    `;
    
    return card;
}

function renderShared() {
    const grid = document.getElementById('shared-grid');
    grid.innerHTML = '';
    
    AppState.sharedMusic.forEach((track, index) => {
        const card = createMusicCard(track, index);
        grid.appendChild(card);
    });
    
    updateEmptyStates();
}

// ===================================
// MUSIC PLAYER
// ===================================
function playTrack(index) {
    AppState.currentTrackIndex = index;
    AppState.currentTrack = AppState.musicLibrary[index];
    AppState.playlist = AppState.musicLibrary;
    
    const audioPlayer = document.getElementById('audio-player');
    const player = document.getElementById('player');
    
    // For demo purposes, we'll use a data URI for silence since we can't play actual files
    // In a real app, you'd use: audioPlayer.src = track.url;
    audioPlayer.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    
    document.getElementById('player-track-name').textContent = AppState.currentTrack.name;
    document.getElementById('player-track-artist').textContent = AppState.currentTrack.artist;
    
    player.classList.remove('hidden');
    audioPlayer.play();
    AppState.isPlaying = true;
    updatePlayButton();
}

function togglePlay() {
    const audioPlayer = document.getElementById('audio-player');
    
    if (AppState.isPlaying) {
        audioPlayer.pause();
        AppState.isPlaying = false;
    } else {
        audioPlayer.play();
        AppState.isPlaying = true;
    }
    
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('play-btn');
    playBtn.textContent = AppState.isPlaying ? '⏸️' : '▶️';
}

function playNext() {
    if (AppState.currentTrackIndex < AppState.playlist.length - 1) {
        playTrack(AppState.currentTrackIndex + 1);
    }
}

function playPrevious() {
    if (AppState.currentTrackIndex > 0) {
        playTrack(AppState.currentTrackIndex - 1);
    }
}

function updateProgress() {
    const audioPlayer = document.getElementById('audio-player');
    const progressFill = document.getElementById('progress-fill');
    const progressSlider = document.getElementById('progress-slider');
    const currentTime = document.getElementById('current-time');
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressFill.style.width = progress + '%';
    progressSlider.value = progress;
    currentTime.textContent = formatTime(audioPlayer.currentTime);
}

function toggleMute() {
    const audioPlayer = document.getElementById('audio-player');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (audioPlayer.volume > 0) {
        audioPlayer.dataset.previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeSlider.value = 0;
        updateVolumeIcon(0);
    } else {
        const previousVolume = parseFloat(audioPlayer.dataset.previousVolume) || 0.8;
        audioPlayer.volume = previousVolume;
        volumeSlider.value = previousVolume * 100;
        updateVolumeIcon(previousVolume * 100);
    }
}

function updateVolumeIcon(value) {
    const volumeBtn = document.getElementById('volume-btn');
    if (value == 0) {
        volumeBtn.textContent = '🔇';
    } else if (value < 50) {
        volumeBtn.textContent = '🔉';
    } else {
        volumeBtn.textContent = '🔊';
    }
}

// ===================================
// SHARING
// ===================================
function shareTrack(trackId) {
    const track = AppState.musicLibrary.find(t => t.id === trackId);
    if (!track) return;
    
    const modal = document.getElementById('share-modal');
    const shareLink = document.getElementById('share-link');
    
    // Generate a shareable link (in real app, this would be a backend URL)
    const link = `${window.location.origin}/share/${trackId}`;
    shareLink.value = link;
    
    modal.classList.add('active');
    
    // Setup copy button
    document.getElementById('copy-btn').onclick = () => {
        shareLink.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
    };
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    modal.classList.remove('active');
}

// ===================================
// LIBRARY MANAGEMENT
// ===================================
function deleteTrack(trackId) {
    if (confirm('Are you sure you want to delete this track?')) {
        AppState.musicLibrary = AppState.musicLibrary.filter(t => t.id !== trackId);
        saveToLocalStorage();
        renderLibrary();
        updateEmptyStates();
        showToast('Track deleted', 'success');
    }
}

function filterLibrary(searchTerm) {
    const cards = document.querySelectorAll('#music-grid .music-card');
    const term = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        const artist = card.querySelector('p').textContent.toLowerCase();
        
        if (name.includes(term) || artist.includes(term)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function sortLibrary(sortBy) {
    switch (sortBy) {
        case 'name':
            AppState.musicLibrary.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'artist':
            AppState.musicLibrary.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
        case 'recent':
        default:
            AppState.musicLibrary.sort((a, b) => 
                new Date(b.dateAdded) - new Date(a.dateAdded)
            );
            break;
    }
    
    renderLibrary();
}

// ===================================
// EMPTY STATES
// ===================================
function updateEmptyStates() {
    const libraryEmpty = document.getElementById('empty-state');
    const sharedEmpty = document.getElementById('shared-empty-state');
    const musicGrid = document.getElementById('music-grid');
    const sharedGrid = document.getElementById('shared-grid');
    
    if (AppState.musicLibrary.length === 0) {
        libraryEmpty.style.display = 'block';
        musicGrid.style.display = 'none';
    } else {
        libraryEmpty.style.display = 'none';
        musicGrid.style.display = 'grid';
    }
    
    if (AppState.sharedMusic.length === 0) {
        sharedEmpty.style.display = 'block';
        sharedGrid.style.display = 'none';
    } else {
        sharedEmpty.style.display = 'none';
        sharedGrid.style.display = 'grid';
    }
}

// ===================================
// TOAST NOTIFICATIONS
// ===================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================================
// LOCAL STORAGE
// ===================================
function saveToLocalStorage() {
    // Save only serializable data (without File objects)
    const libraryToSave = AppState.musicLibrary.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artist,
        duration: track.duration,
        size: track.size,
        dateAdded: track.dateAdded,
        emoji: track.emoji
    }));
    
    localStorage.setItem('soundvault_library', JSON.stringify(libraryToSave));
    localStorage.setItem('soundvault_shared', JSON.stringify(AppState.sharedMusic));
}

function loadFromLocalStorage() {
    const library = localStorage.getItem('soundvault_library');
    const shared = localStorage.getItem('soundvault_shared');
    
    if (library) {
        AppState.musicLibrary = JSON.parse(library);
    }
    
    if (shared) {
        AppState.sharedMusic = JSON.parse(shared);
    }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRandomEmoji() {
    const emojis = ['🎵', '🎶', '🎸', '🎹', '🎺', '🎷', '🥁', '🎤', '🎧', '📻', '🎼', '🎻', '🪕', '🎺'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Space: Play/Pause
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        if (AppState.currentTrack) {
            togglePlay();
        }
    }
    
    // Arrow Left: Previous track
    if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        playPrevious();
    }
    
    // Arrow Right: Next track
    if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        playNext();
    }
});

// ===================================
// CLOSE MODAL ON OUTSIDE CLICK
// ===================================
document.getElementById('share-modal').addEventListener('click', (e) => {
    if (e.target.id === 'share-modal') {
        closeShareModal();
    }
});
