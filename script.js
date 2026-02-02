// ===================================
// STATE MANAGEMENT
// ===================================
const AppState = {
    songs: [],
    albums: {},
    currentTrack: null,
    isPlaying: false,
    currentIndex: -1,
    playlist: [],
    shuffle: false,
    repeat: false,
    volume: 0.8
};

// ===================================
// LOADING SCREEN
// ===================================
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('loaded');
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }, 1500);
});

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    setupEventListeners();
    renderCurrentView();
    updateStorageInfo();
});

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });
    
    // Upload
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
    
    // Search & Sort
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterContent(e.target.value));
    }
    
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => sortContent(e.target.value));
    }
    
    // Player Controls
    setupPlayerControls();
}

function setupPlayerControls() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const audioPlayer = document.getElementById('audio-player');
    const progressBar = document.getElementById('progress-bar');
    
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);
    if (nextBtn) nextBtn.addEventListener('click', playNext);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);
    if (volumeBtn) volumeBtn.addEventListener('click', toggleMute);
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            if (audioPlayer) audioPlayer.volume = volume;
            AppState.volume = volume;
            updateVolumeIcon(volume);
        });
    }
    
    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', handleTrackEnd);
        audioPlayer.addEventListener('loadedmetadata', () => {
            const duration = formatTime(audioPlayer.duration);
            const durationEl = document.getElementById('duration-time');
            if (durationEl) durationEl.textContent = duration;
        });
        audioPlayer.volume = AppState.volume;
    }
    
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (audioPlayer && !isNaN(audioPlayer.duration)) {
                audioPlayer.currentTime = percent * audioPlayer.duration;
            }
        });
    }
}

// ===================================
// VIEW SWITCHING
// ===================================
function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
        renderCurrentView();
    }
}

window.switchView = switchView;

function renderCurrentView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;
    
    const viewId = activeView.id;
    
    if (viewId === 'songs-view') {
        renderSongs();
    } else if (viewId === 'albums-view') {
        renderAlbums();
    }
}

// ===================================
// FILE UPLOAD & METADATA EXTRACTION
// ===================================
async function handleFiles(files) {
    const uploadQueue = document.getElementById('upload-queue');
    if (!uploadQueue) return;
    
    for (const file of Array.from(files)) {
        if (!file.type.startsWith('audio/')) {
            showToast('Only audio files are supported', 'error');
            continue;
        }
        
        const uploadItem = createUploadItem(file);
        uploadQueue.appendChild(uploadItem);
        
        try {
            await processAudioFile(file, uploadItem);
        } catch (error) {
            console.error('Error processing file:', error);
            showToast(`Error processing ${file.name}`, 'error');
            uploadItem.remove();
        }
    }
}

function createUploadItem(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.innerHTML = `
        <div class="upload-item-info">
            <h4>${escapeHtml(file.name)}</h4>
            <p>Processing metadata...</p>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
    return item;
}

async function processAudioFile(file, uploadItem) {
    return new Promise((resolve, reject) => {
        const progressFill = uploadItem.querySelector('.upload-progress-fill');
        const statusText = uploadItem.querySelector('p');
        
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 200);
        
        // Extract metadata using jsmediatags
        window.jsmediatags.read(file, {
            onSuccess: async (tag) => {
                clearInterval(progressInterval);
                progressFill.style.width = '100%';
                
                const metadata = tag.tags;
                const audioURL = URL.createObjectURL(file);
                
                // Get duration
                const audio = new Audio(audioURL);
                await new Promise(res => {
                    audio.addEventListener('loadedmetadata', res);
                });
                
                // Extract album art
                let artworkURL = null;
                if (metadata.picture) {
                    const { data, format } = metadata.picture;
                    const blob = new Blob([new Uint8Array(data)], { type: format });
                    artworkURL = URL.createObjectURL(blob);
                }
                
                const song = {
                    id: generateId(),
                    title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
                    artist: metadata.artist || 'Unknown Artist',
                    album: metadata.album || 'Unknown Album',
                    year: metadata.year || '',
                    track: metadata.track || '',
                    duration: audio.duration,
                    file: file,
                    url: audioURL,
                    artwork: artworkURL,
                    dateAdded: new Date().toISOString()
                };
                
                AppState.songs.push(song);
                organizeAlbums();
                saveToStorage();
                
                statusText.textContent = 'Complete!';
                setTimeout(() => {
                    uploadItem.remove();
                    renderCurrentView();
                    updateStorageInfo();
                    showToast(`Added: ${song.title}`, 'success');
                }, 500);
                
                resolve();
            },
            onError: (error) => {
                // If metadata extraction fails, create basic entry
                clearInterval(progressInterval);
                console.log('Metadata extraction failed, using basic info:', error);
                
                const audioURL = URL.createObjectURL(file);
                const audio = new Audio(audioURL);
                
                audio.addEventListener('loadedmetadata', () => {
                    const song = {
                        id: generateId(),
                        title: file.name.replace(/\.[^/.]+$/, ''),
                        artist: 'Unknown Artist',
                        album: 'Unknown Album',
                        year: '',
                        track: '',
                        duration: audio.duration,
                        file: file,
                        url: audioURL,
                        artwork: null,
                        dateAdded: new Date().toISOString()
                    };
                    
                    AppState.songs.push(song);
                    organizeAlbums();
                    saveToStorage();
                    
                    progressFill.style.width = '100%';
                    statusText.textContent = 'Complete!';
                    setTimeout(() => {
                        uploadItem.remove();
                        renderCurrentView();
                        updateStorageInfo();
                        showToast(`Added: ${song.title}`, 'success');
                    }, 500);
                    
                    resolve();
                });
            }
        });
    });
}

function organizeAlbums() {
    AppState.albums = {};
    
    AppState.songs.forEach(song => {
        const albumKey = `${song.artist}-${song.album}`;
        
        if (!AppState.albums[albumKey]) {
            AppState.albums[albumKey] = {
                id: albumKey,
                title: song.album,
                artist: song.artist,
                year: song.year,
                artwork: song.artwork,
                tracks: []
            };
        }
        
        AppState.albums[albumKey].tracks.push(song);
        
        // Update artwork if this song has one and album doesn't
        if (song.artwork && !AppState.albums[albumKey].artwork) {
            AppState.albums[albumKey].artwork = song.artwork;
        }
    });
    
    // Sort tracks within each album
    Object.values(AppState.albums).forEach(album => {
        album.tracks.sort((a, b) => {
            const trackA = parseInt(a.track) || 999;
            const trackB = parseInt(b.track) || 999;
            return trackA - trackB;
        });
    });
}

// ===================================
// RENDERING
// ===================================
function renderSongs() {
    const songsList = document.getElementById('songs-list');
    const songsEmpty = document.getElementById('songs-empty');
    const songsCount = document.getElementById('songs-count');
    
    if (!songsList) return;
    
    if (AppState.songs.length === 0) {
        songsList.style.display = 'none';
        if (songsEmpty) songsEmpty.style.display = 'block';
        if (songsCount) songsCount.textContent = '0 tracks';
        return;
    }
    
    songsList.style.display = 'flex';
    if (songsEmpty) songsEmpty.style.display = 'none';
    if (songsCount) songsCount.textContent = `${AppState.songs.length} track${AppState.songs.length === 1 ? '' : 's'}`;
    
    songsList.innerHTML = '';
    
    AppState.songs.forEach((song, index) => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.innerHTML = `
            <div class="song-number">${index + 1}</div>
            <div class="song-info">
                <img class="song-artwork" src="${song.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E'}" alt="">
                <div class="song-text">
                    <div class="song-title">${escapeHtml(song.title)}</div>
                    <div class="song-artist">${escapeHtml(song.artist)}</div>
                </div>
            </div>
            <div class="song-album">${escapeHtml(song.album)}</div>
            <div class="song-duration">${formatTime(song.duration)}</div>
            <div class="song-actions">
                <button class="action-icon-btn delete-song-btn" data-id="${song.id}" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                        <path d="M6 2h6v2H6V2zM3 5h12v2H3V5zm1 3h10v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z"/>
                    </svg>
                </button>
            </div>
        `;
        
        songItem.addEventListener('click', (e) => {
            if (!e.target.closest('.action-icon-btn')) {
                playSong(index);
            }
        });
        
        const deleteBtn = songItem.querySelector('.delete-song-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song.id);
            });
        }
        
        songsList.appendChild(songItem);
    });
}

function renderAlbums() {
    const albumsGrid = document.getElementById('albums-grid');
    const albumsEmpty = document.getElementById('albums-empty');
    const albumsCount = document.getElementById('albums-count');
    
    if (!albumsGrid) return;
    
    const albumsArray = Object.values(AppState.albums);
    
    if (albumsArray.length === 0) {
        albumsGrid.style.display = 'none';
        if (albumsEmpty) albumsEmpty.style.display = 'block';
        if (albumsCount) albumsCount.textContent = '0 albums';
        return;
    }
    
    albumsGrid.style.display = 'grid';
    if (albumsEmpty) albumsEmpty.style.display = 'none';
    if (albumsCount) albumsCount.textContent = `${albumsArray.length} album${albumsArray.length === 1 ? '' : 's'}`;
    
    albumsGrid.innerHTML = '';
    
    albumsArray.forEach(album => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        albumCard.innerHTML = `
            <img class="album-artwork" src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" alt="">
            <div class="album-info">
                <h3>${escapeHtml(album.title)}</h3>
                <p>${escapeHtml(album.artist)}</p>
                <div class="album-meta">${album.year || 'Unknown Year'} • ${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}</div>
            </div>
        `;
        
        albumCard.addEventListener('click', () => showAlbumDetail(album));
        
        albumsGrid.appendChild(albumCard);
    });
}

function showAlbumDetail(album) {
    const detailView = document.getElementById('album-detail-view');
    const detailContent = document.getElementById('album-detail-content');
    
    if (!detailView || !detailContent) return;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    detailView.classList.add('active');
    
    detailContent.innerHTML = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <img src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" 
                 style="width: 200px; height: 200px; border-radius: 8px; object-fit: cover;" alt="">
            <div>
                <h2 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${escapeHtml(album.title)}</h2>
                <p style="font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 1rem;">${escapeHtml(album.artist)}</p>
                <p style="color: var(--text-muted);">${album.year || 'Unknown Year'} • ${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}</p>
                <button class="btn-primary" style="margin-top: 1.5rem;" onclick="playAlbum('${album.id}')">Play Album</button>
            </div>
        </div>
        <div class="songs-list" id="album-tracks"></div>
    `;
    
    const tracksList = document.getElementById('album-tracks');
    if (tracksList) {
        album.tracks.forEach((song, index) => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-number">${song.track || index + 1}</div>
                <div class="song-info">
                    <div class="song-text">
                        <div class="song-title">${escapeHtml(song.title)}</div>
                        <div class="song-artist">${escapeHtml(song.artist)}</div>
                    </div>
                </div>
                <div class="song-album">${escapeHtml(song.album)}</div>
                <div class="song-duration">${formatTime(song.duration)}</div>
            `;
            
            songItem.addEventListener('click', () => {
                const songIndex = AppState.songs.findIndex(s => s.id === song.id);
                if (songIndex !== -1) playSong(songIndex);
            });
            
            tracksList.appendChild(songItem);
        });
    }
}

window.playAlbum = function(albumId) {
    const album = AppState.albums[albumId];
    if (!album || album.tracks.length === 0) return;
    
    const firstTrack = album.tracks[0];
    const songIndex = AppState.songs.findIndex(s => s.id === firstTrack.id);
    if (songIndex !== -1) playSong(songIndex);
};

// ===================================
// PLAYBACK
// ===================================
function playSong(index) {
    if (index < 0 || index >= AppState.songs.length) return;
    
    AppState.currentIndex = index;
    AppState.currentTrack = AppState.songs[index];
    AppState.playlist = AppState.songs;
    
    const audioPlayer = document.getElementById('audio-player');
    const player = document.getElementById('player');
    const playerArtwork = document.getElementById('player-artwork');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    
    if (!audioPlayer || !player) return;
    
    audioPlayer.src = AppState.currentTrack.url;
    
    if (playerArtwork) {
        playerArtwork.src = AppState.currentTrack.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E';
    }
    if (playerTitle) playerTitle.textContent = AppState.currentTrack.title;
    if (playerArtist) playerArtist.textContent = AppState.currentTrack.artist;
    
    player.classList.remove('hidden');
    
    audioPlayer.play().then(() => {
        AppState.isPlaying = true;
        updatePlayPauseButton();
    }).catch(error => {
        console.error('Playback error:', error);
        showToast('Error playing track', 'error');
    });
}

function togglePlayPause() {
    const audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) return;
    
    if (AppState.isPlaying) {
        audioPlayer.pause();
        AppState.isPlaying = false;
    } else {
        audioPlayer.play().then(() => {
            AppState.isPlaying = true;
        });
    }
    
    updatePlayPauseButton();
}

function updatePlayPauseButton() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (playIcon && pauseIcon) {
        if (AppState.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
}

function playNext() {
    if (AppState.shuffle) {
        const randomIndex = Math.floor(Math.random() * AppState.songs.length);
        playSong(randomIndex);
    } else if (AppState.currentIndex < AppState.songs.length - 1) {
        playSong(AppState.currentIndex + 1);
    } else if (AppState.repeat) {
        playSong(0);
    }
}

function playPrevious() {
    if (AppState.currentIndex > 0) {
        playSong(AppState.currentIndex - 1);
    } else if (AppState.repeat) {
        playSong(AppState.songs.length - 1);
    }
}

function handleTrackEnd() {
    if (AppState.repeat) {
        playSong(AppState.currentIndex);
    } else {
        playNext();
    }
}

function toggleShuffle() {
    AppState.shuffle = !AppState.shuffle;
    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', AppState.shuffle);
    }
    showToast(AppState.shuffle ? 'Shuffle enabled' : 'Shuffle disabled', 'success');
}

function toggleRepeat() {
    AppState.repeat = !AppState.repeat;
    const repeatBtn = document.getElementById('repeat-btn');
    if (repeatBtn) {
        repeatBtn.classList.toggle('active', AppState.repeat);
    }
    showToast(AppState.repeat ? 'Repeat enabled' : 'Repeat disabled', 'success');
}

function toggleMute() {
    const audioPlayer = document.getElementById('audio-player');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (!audioPlayer) return;
    
    if (audioPlayer.volume > 0) {
        audioPlayer.dataset.previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        if (volumeSlider) volumeSlider.value = 0;
        updateVolumeIcon(0);
    } else {
        const previousVolume = parseFloat(audioPlayer.dataset.previousVolume) || 0.8;
        audioPlayer.volume = previousVolume;
        if (volumeSlider) volumeSlider.value = previousVolume * 100;
        updateVolumeIcon(previousVolume);
    }
}

function updateVolumeIcon(volume) {
    const volumeIcon = document.getElementById('volume-icon');
    if (!volumeIcon) return;
    
    if (volume === 0) {
        volumeIcon.innerHTML = '<path d="M10 3.5L5 7H2v6h3l5 3.5V3.5zM14 10l3-3M17 10l-3-3"/>';
    } else if (volume < 0.5) {
        volumeIcon.innerHTML = '<path d="M10 3.5L5 7H2v6h3l5 3.5V3.5zm4 2v9c.83-.55 1.5-1.47 1.5-2.5S14.83 10.05 14 9.5z"/>';
    } else {
        volumeIcon.innerHTML = '<path d="M10 3.5L5 7H2v6h3l5 3.5V3.5zm4 2.25v8.5c1.5-1 2.5-2.75 2.5-4.25S15.5 6.75 14 5.75z"/>';
    }
}

function updateProgress() {
    const audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer || isNaN(audioPlayer.duration)) return;
    
    const progressFill = document.getElementById('progress-fill');
    const progressHandle = document.getElementById('progress-handle');
    const currentTime = document.getElementById('current-time');
    
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressHandle) progressHandle.style.left = percent + '%';
    if (currentTime) currentTime.textContent = formatTime(audioPlayer.currentTime);
}

// ===================================
// SEARCH & SORT
// ===================================
function filterContent(searchTerm) {
    const term = searchTerm.toLowerCase();
    const activeView = document.querySelector('.view.active');
    
    if (!activeView) return;
    
    if (activeView.id === 'songs-view') {
        const songItems = document.querySelectorAll('.song-item');
        songItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'grid' : 'none';
        });
    } else if (activeView.id === 'albums-view') {
        const albumCards = document.querySelectorAll('.album-card');
        albumCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(term) ? 'block' : 'none';
        });
    }
}

function sortContent(sortBy) {
    switch (sortBy) {
        case 'title':
            AppState.songs.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'artist':
            AppState.songs.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
        case 'album':
            AppState.songs.sort((a, b) => a.album.localeCompare(b.album));
            break;
        case 'recent':
        default:
            AppState.songs.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
    }
    
    renderCurrentView();
}

// ===================================
// DELETE
// ===================================
function deleteSong(songId) {
    if (!confirm('Delete this song?')) return;
    
    AppState.songs = AppState.songs.filter(s => s.id !== songId);
    organizeAlbums();
    saveToStorage();
    renderCurrentView();
    updateStorageInfo();
    showToast('Song deleted', 'success');
}

// ===================================
// STORAGE
// ===================================
function saveToStorage() {
    const songsToSave = AppState.songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        year: song.year,
        track: song.track,
        duration: song.duration,
        dateAdded: song.dateAdded
    }));
    
    try {
        localStorage.setItem('musicvault_songs', JSON.stringify(songsToSave));
    } catch (error) {
        console.error('Failed to save to storage:', error);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('musicvault_songs');
        if (saved) {
            AppState.songs = JSON.parse(saved);
            organizeAlbums();
        }
    } catch (error) {
        console.error('Failed to load from storage:', error);
    }
}

function updateStorageInfo() {
    const storageFill = document.getElementById('storage-fill');
    const storageText = document.getElementById('storage-text');
    
    const count = AppState.songs.length;
    const percent = Math.min((count / 100) * 100, 100);
    
    if (storageFill) storageFill.style.width = percent + '%';
    if (storageText) storageText.textContent = `${count} track${count === 1 ? '' : 's'}`;
}

// ===================================
// UTILITIES
// ===================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-message">${escapeHtml(message)}</div>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
