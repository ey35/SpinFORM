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
    playlist: [],
    shuffle: false,
    repeat: false,
    audioContext: null,
    analyser: null,
    dataArray: null
};

// ===================================
// LOADING SCREEN
// ===================================
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('loaded');
        
        // Remove from DOM after animation
        setTimeout(() => {
            loadingScreen.remove();
        }, 500);
    }, 2000); // Show loading screen for 2 seconds
});

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadFromLocalStorage();
    setupEventListeners();
    renderLibrary();
    updateEmptyStates();
    initAudioContext();
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
            emoji: '🌃',
            genre: 'Synthwave'
        },
        {
            id: generateId(),
            name: 'Electric Horizon',
            artist: 'Cyber Sound',
            duration: '4:12',
            size: '6.1 MB',
            dateAdded: new Date().toISOString(),
            emoji: '⚡',
            genre: 'Electronic'
        },
        {
            id: generateId(),
            name: 'Digital Paradise',
            artist: 'Future Beats',
            duration: '3:28',
            size: '4.8 MB',
            dateAdded: new Date().toISOString(),
            emoji: '🎮',
            genre: 'Chillwave'
        },
        {
            id: generateId(),
            name: 'Cyber Nights',
            artist: 'Retro Wave',
            duration: '4:55',
            size: '6.8 MB',
            dateAdded: new Date().toISOString(),
            emoji: '🌆',
            genre: 'Synthwave'
        },
        {
            id: generateId(),
            name: 'Pixel Dreams',
            artist: 'Arcade Sound',
            duration: '3:15',
            size: '4.5 MB',
            dateAdded: new Date().toISOString(),
            emoji: '👾',
            genre: 'Chiptune'
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
        btn.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });
    
    // Upload Zone
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    
    if (uploadZone && fileInput) {
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
    }
    
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterLibrary(e.target.value);
        });
    }
    
    // Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortLibrary(e.target.value);
        });
    }
    
    // Player Controls
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);
    if (nextBtn) nextBtn.addEventListener('click', playNext);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);
    
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', handleTrackEnd);
        audioPlayer.addEventListener('loadedmetadata', () => {
            const duration = formatTime(audioPlayer.duration);
            const durationEl = document.getElementById('duration-time');
            if (durationEl) durationEl.textContent = duration;
        });
    }
    
    // Progress Bar
    const progressSlider = document.getElementById('progress-slider');
    if (progressSlider) {
        progressSlider.addEventListener('input', (e) => {
            const audioPlayer = document.getElementById('audio-player');
            if (audioPlayer && !isNaN(audioPlayer.duration)) {
                const time = (e.target.value / 100) * audioPlayer.duration;
                audioPlayer.currentTime = time;
            }
        });
    }
    
    // Volume Control
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const audioPlayer = document.getElementById('audio-player');
            if (audioPlayer) {
                audioPlayer.volume = e.target.value / 100;
                updateVolumeIcon(e.target.value);
            }
        });
    }
    
    if (volumeBtn) {
        volumeBtn.addEventListener('click', toggleMute);
    }
    
    // Initialize volume
    if (audioPlayer) {
        audioPlayer.volume = 0.8;
    }
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
    
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
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
    if (!uploadQueue) return;
    
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
            <h4>${escapeHtml(file.name)}</h4>
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
        genre: 'Uploaded',
        file: file
    };
    
    // If it's a real file, create object URL
    if (file instanceof File) {
        track.url = URL.createObjectURL(file);
        
        // Get duration from audio file
        const audio = new Audio(track.url);
        audio.addEventListener('loadedmetadata', () => {
            track.duration = formatTime(audio.duration);
            saveToLocalStorage();
            renderLibrary();
        });
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
    if (!grid) return;
    
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
            <h3>${escapeHtml(track.name)}</h3>
            <p>${escapeHtml(track.artist)}</p>
            <div class="music-meta">
                <span>⏱️ ${track.duration}</span>
                <span>💾 ${track.size}</span>
            </div>
        </div>
        <div class="music-actions">
            <button class="action-btn play-track-btn" data-index="${index}">▶️ Play</button>
            <button class="action-btn share-track-btn" data-id="${track.id}">🔗 Share</button>
            <button class="action-btn delete-track-btn" data-id="${track.id}">🗑️ Delete</button>
        </div>
    `;
    
    // Add event listeners
    const playBtn = card.querySelector('.play-track-btn');
    const shareBtn = card.querySelector('.share-track-btn');
    const deleteBtn = card.querySelector('.delete-track-btn');
    
    if (playBtn) {
        playBtn.addEventListener('click', () => playTrack(index));
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareTrack(track.id));
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteTrack(track.id));
    }
    
    return card;
}

function renderShared() {
    const grid = document.getElementById('shared-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    AppState.sharedMusic.forEach((track, index) => {
        const card = createMusicCard(track, index);
        grid.appendChild(card);
    });
    
    updateEmptyStates();
}

// ===================================
// AUDIO CONTEXT & VISUALIZER
// ===================================
function initAudioContext() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        AppState.audioContext = new AudioContext();
        AppState.analyser = AppState.audioContext.createAnalyser();
        AppState.analyser.fftSize = 256;
        
        const bufferLength = AppState.analyser.frequencyBinCount;
        AppState.dataArray = new Uint8Array(bufferLength);
        
        // Connect audio element to analyser
        const audioPlayer = document.getElementById('audio-player');
        if (audioPlayer) {
            const source = AppState.audioContext.createMediaElementSource(audioPlayer);
            source.connect(AppState.analyser);
            AppState.analyser.connect(AppState.audioContext.destination);
        }
        
        visualize();
    } catch (error) {
        console.log('Web Audio API not supported:', error);
    }
}

function visualize() {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    function draw() {
        requestAnimationFrame(draw);
        
        if (!AppState.analyser || !AppState.dataArray) return;
        
        AppState.analyser.getByteFrequencyData(AppState.dataArray);
        
        ctx.fillStyle = 'rgba(10, 14, 39, 0.2)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        
        const barWidth = (WIDTH / AppState.dataArray.length) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < AppState.dataArray.length; i++) {
            barHeight = (AppState.dataArray[i] / 255) * HEIGHT;
            
            // Create gradient for bars
            const gradient = ctx.createLinearGradient(0, HEIGHT - barHeight, 0, HEIGHT);
            gradient.addColorStop(0, '#FF006E');
            gradient.addColorStop(0.5, '#8338EC');
            gradient.addColorStop(1, '#3A86FF');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    draw();
}

// ===================================
// MUSIC PLAYER
// ===================================
function playTrack(index) {
    if (index < 0 || index >= AppState.musicLibrary.length) return;
    
    AppState.currentTrackIndex = index;
    AppState.currentTrack = AppState.musicLibrary[index];
    AppState.playlist = AppState.musicLibrary;
    
    const audioPlayer = document.getElementById('audio-player');
    const player = document.getElementById('player');
    
    if (!audioPlayer || !player) return;
    
    // For real uploaded files with URL
    if (AppState.currentTrack.url) {
        audioPlayer.src = AppState.currentTrack.url;
    } else {
        // For demo tracks, use a silent audio file
        audioPlayer.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    }
    
    const trackNameEl = document.getElementById('player-track-name');
    const trackArtistEl = document.getElementById('player-track-artist');
    
    if (trackNameEl) trackNameEl.textContent = AppState.currentTrack.name;
    if (trackArtistEl) trackArtistEl.textContent = AppState.currentTrack.artist;
    
    player.classList.remove('hidden');
    
    // Resume audio context if suspended
    if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
        AppState.audioContext.resume();
    }
    
    audioPlayer.play().then(() => {
        AppState.isPlaying = true;
        updatePlayButton();
    }).catch(error => {
        console.log('Playback error:', error);
        showToast('Error playing track', 'error');
    });
}

function togglePlay() {
    const audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) return;
    
    if (AppState.isPlaying) {
        audioPlayer.pause();
        AppState.isPlaying = false;
    } else {
        audioPlayer.play().then(() => {
            AppState.isPlaying = true;
        }).catch(error => {
            console.log('Playback error:', error);
        });
    }
    
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.textContent = AppState.isPlaying ? '⏸️' : '▶️';
    }
}

function playNext() {
    if (AppState.shuffle) {
        const randomIndex = Math.floor(Math.random() * AppState.musicLibrary.length);
        playTrack(randomIndex);
    } else if (AppState.currentTrackIndex < AppState.playlist.length - 1) {
        playTrack(AppState.currentTrackIndex + 1);
    } else if (AppState.repeat) {
        playTrack(0);
    }
}

function playPrevious() {
    if (AppState.currentTrackIndex > 0) {
        playTrack(AppState.currentTrackIndex - 1);
    } else if (AppState.repeat) {
        playTrack(AppState.playlist.length - 1);
    }
}

function handleTrackEnd() {
    if (AppState.repeat) {
        playTrack(AppState.currentTrackIndex);
    } else {
        playNext();
    }
}

function toggleShuffle() {
    AppState.shuffle = !AppState.shuffle;
    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.style.background = AppState.shuffle ? 
            'linear-gradient(135deg, var(--neon-pink), var(--neon-purple))' : 
            'rgba(131, 56, 236, 0.2)';
    }
    showToast(AppState.shuffle ? 'Shuffle enabled' : 'Shuffle disabled', 'success');
}

function toggleRepeat() {
    AppState.repeat = !AppState.repeat;
    const repeatBtn = document.getElementById('repeat-btn');
    if (repeatBtn) {
        repeatBtn.style.background = AppState.repeat ? 
            'linear-gradient(135deg, var(--neon-pink), var(--neon-purple))' : 
            'rgba(131, 56, 236, 0.2)';
    }
    showToast(AppState.repeat ? 'Repeat enabled' : 'Repeat disabled', 'success');
}

function updateProgress() {
    const audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer || isNaN(audioPlayer.duration)) return;
    
    const progressFill = document.getElementById('progress-fill');
    const progressSlider = document.getElementById('progress-slider');
    const currentTime = document.getElementById('current-time');
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressSlider) progressSlider.value = progress;
    if (currentTime) currentTime.textContent = formatTime(audioPlayer.currentTime);
}

function toggleMute() {
    const audioPlayer = document.getElementById('audio-player');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (!audioPlayer || !volumeSlider) return;
    
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
    if (!volumeBtn) return;
    
    if (value == 0) {
        volumeBtn.textContent = '🔇';
    } else if (value < 50) {
        volumeBtn.textContent = '🔉';
    } else {
        volumeBtn.textContent = '🔊';
    }
}

// ===================================
// AI RECOMMENDATIONS
// ===================================
function getAIRecommendations() {
    const promptEl = document.getElementById('ai-prompt');
    const resultsEl = document.getElementById('ai-results');
    
    if (!promptEl || !resultsEl) return;
    
    const prompt = promptEl.value.trim();
    
    if (!prompt) {
        showToast('Please enter a prompt', 'error');
        return;
    }
    
    // Show loading
    resultsEl.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-spinner"></div>
            <p>Analyzing your music taste and generating recommendations...</p>
        </div>
    `;
    
    // Simulate AI response (in real app, this would call an API)
    setTimeout(() => {
        const recommendations = generateMockRecommendations(prompt);
        displayRecommendations(recommendations);
    }, 2000);
}

function generateMockRecommendations(prompt) {
    const recommendations = [
        {
            title: 'Synthwave Essentials',
            description: 'Based on your love for retro-futuristic sounds, dive into these pulsating synthwave tracks that blend 80s nostalgia with modern production. Perfect for late-night coding sessions.',
            tags: ['Synthwave', 'Retro', 'Electronic', 'Upbeat']
        },
        {
            title: 'Cyberpunk Nights',
            description: 'High-energy electronic beats with dark atmospheric elements. These tracks capture the essence of neon-lit cityscapes and digital dystopias.',
            tags: ['Cyberpunk', 'Dark', 'Energetic', 'Futuristic']
        },
        {
            title: 'Chillwave Dreams',
            description: 'Mellow, dreamy tracks perfect for relaxation and focus. Lo-fi beats meet ethereal synths in this collection of ambient masterpieces.',
            tags: ['Chillwave', 'Ambient', 'Relaxing', 'Lo-Fi']
        },
        {
            title: 'Vaporwave Aesthetic',
            description: 'Explore the nostalgic sounds of vaporwave with slowed-down samples, smooth jazz influences, and that signature retro internet culture vibe.',
            tags: ['Vaporwave', 'Nostalgic', 'Chill', 'Experimental']
        }
    ];
    
    return recommendations;
}

function displayRecommendations(recommendations) {
    const resultsEl = document.getElementById('ai-results');
    if (!resultsEl) return;
    
    resultsEl.innerHTML = '';
    
    recommendations.forEach((rec, index) => {
        const recEl = document.createElement('div');
        recEl.className = 'ai-recommendation';
        recEl.style.animationDelay = `${index * 0.1}s`;
        
        recEl.innerHTML = `
            <h4>${escapeHtml(rec.title)}</h4>
            <p>${escapeHtml(rec.description)}</p>
            <div class="ai-tags">
                ${rec.tags.map(tag => `<span class="ai-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
        
        resultsEl.appendChild(recEl);
    });
}

// Make function globally accessible
window.getAIRecommendations = getAIRecommendations;

// ===================================
// SHARING
// ===================================
function shareTrack(trackId) {
    const track = AppState.musicLibrary.find(t => t.id === trackId);
    if (!track) return;
    
    const modal = document.getElementById('share-modal');
    const shareLink = document.getElementById('share-link');
    
    if (!modal || !shareLink) return;
    
    // Generate a shareable link
    const link = `${window.location.origin}/share/${trackId}`;
    shareLink.value = link;
    
    modal.classList.add('active');
    
    // Setup copy button
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.onclick = () => {
            shareLink.select();
            shareLink.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                document.execCommand('copy');
                showToast('Link copied to clipboard!', 'success');
            } catch (err) {
                // Fallback for modern browsers
                navigator.clipboard.writeText(shareLink.value).then(() => {
                    showToast('Link copied to clipboard!', 'success');
                }).catch(() => {
                    showToast('Failed to copy link', 'error');
                });
            }
        };
    }
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Make function globally accessible
window.closeShareModal = closeShareModal;

// ===================================
// LIBRARY MANAGEMENT
// ===================================
function deleteTrack(trackId) {
    if (!confirm('Are you sure you want to delete this track?')) return;
    
    AppState.musicLibrary = AppState.musicLibrary.filter(t => t.id !== trackId);
    saveToLocalStorage();
    renderLibrary();
    updateEmptyStates();
    showToast('Track deleted', 'success');
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
    
    if (libraryEmpty && musicGrid) {
        if (AppState.musicLibrary.length === 0) {
            libraryEmpty.style.display = 'block';
            musicGrid.style.display = 'none';
        } else {
            libraryEmpty.style.display = 'none';
            musicGrid.style.display = 'grid';
        }
    }
    
    if (sharedEmpty && sharedGrid) {
        if (AppState.sharedMusic.length === 0) {
            sharedEmpty.style.display = 'block';
            sharedGrid.style.display = 'none';
        } else {
            sharedEmpty.style.display = 'none';
            sharedGrid.style.display = 'grid';
        }
    }
}

// ===================================
// TOAST NOTIFICATIONS
// ===================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-message">${escapeHtml(message)}</div>
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
        emoji: track.emoji,
        genre: track.genre || 'Unknown'
    }));
    
    try {
        localStorage.setItem('soundvault_library', JSON.stringify(libraryToSave));
        localStorage.setItem('soundvault_shared', JSON.stringify(AppState.sharedMusic));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const library = localStorage.getItem('soundvault_library');
        const shared = localStorage.getItem('soundvault_shared');
        
        if (library) {
            AppState.musicLibrary = JSON.parse(library);
        }
        
        if (shared) {
            AppState.sharedMusic = JSON.parse(shared);
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
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
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRandomEmoji() {
    const emojis = ['🎵', '🎶', '🎸', '🎹', '🎺', '🎷', '🥁', '🎤', '🎧', '📻', '🎼', '🎻', '🪕', '🎺', '🌃', '⚡', '🎮', '🌆', '👾', '🚀', '💜', '💖'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Space: Play/Pause
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
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
const shareModal = document.getElementById('share-modal');
if (shareModal) {
    shareModal.addEventListener('click', (e) => {
        if (e.target.id === 'share-modal') {
            closeShareModal();
        }
    });
}
