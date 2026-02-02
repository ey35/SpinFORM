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
    volume: 0.8,
    uploadType: 'songs',
    pendingFiles: [],
    contextMenuTarget: null,
    colorThief: null
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
    AppState.colorThief = new ColorThief();
    loadFromStorage();
    setupEventListeners();
    renderCurrentView();
    updateStorageInfo();
    setupDragAndDrop();
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
    
    // Upload Type Modal
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            AppState.uploadType = this.dataset.type;
            closeUploadTypeModal();
            processUploadQueue();
        });
    });
    
    // Context Menu
    document.addEventListener('click', () => closeContextMenu());
    document.addEventListener('contextmenu', (e) => {
        const songItem = e.target.closest('.song-item');
        const albumCard = e.target.closest('.album-card');
        
        if (songItem || albumCard) {
            e.preventDefault();
            showContextMenu(e, songItem || albumCard);
        }
    });
    
    // Lyrics button
    const lyricsBtn = document.getElementById('lyrics-btn');
    if (lyricsBtn) {
        lyricsBtn.addEventListener('click', showLyricsModal);
    }
    
    // Favorite button in player
    const favoritePlayerBtn = document.getElementById('favorite-player-btn');
    if (favoritePlayerBtn) {
        favoritePlayerBtn.addEventListener('click', () => {
            if (AppState.currentTrack) {
                toggleFavorite(AppState.currentTrack.id);
            }
        });
    }
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
    const progressBarContainer = document.querySelector('.progress-bar-container');
    
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
    
    if (progressBarContainer) {
        let isDragging = false;
        
        const updateProgressFromMouse = (e) => {
            const rect = progressBarContainer.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audioPlayer && !isNaN(audioPlayer.duration)) {
                audioPlayer.currentTime = percent * audioPlayer.duration;
            }
        };
        
        progressBarContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateProgressFromMouse(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateProgressFromMouse(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
}

function setupDragAndDrop() {
    const albumsGrid = document.getElementById('albums-grid');
    if (albumsGrid) {
        new Sortable(albumsGrid, {
            animation: 200,
            ghostClass: 'dragging',
            dragClass: 'dragging',
            onEnd: function(evt) {
                // Reorder albums in state based on new DOM order
                const newOrder = [];
                const gridItems = albumsGrid.querySelectorAll('.album-card');
                gridItems.forEach(item => {
                    const albumId = item.dataset.albumId;
                    if (albumId && AppState.albums[albumId]) {
                        newOrder.push(AppState.albums[albumId]);
                    }
                });
                
                // Rebuild albums object in new order
                const newAlbums = {};
                newOrder.forEach(album => {
                    newAlbums[album.id] = album;
                });
                AppState.albums = newAlbums;
                saveToStorage();
                showToast('Album order updated', 'success');
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
    } else if (viewId === 'favorites-view') {
        renderFavorites();
    }
}

// ===================================
// FILE UPLOAD & METADATA EXTRACTION
// ===================================
async function handleFiles(files) {
    if (files.length === 0) return;
    
    AppState.pendingFiles = Array.from(files);
    
    // Show upload type modal
    const modal = document.getElementById('upload-type-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeUploadTypeModal() {
    const modal = document.getElementById('upload-type-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function processUploadQueue() {
    const uploadQueue = document.getElementById('upload-queue');
    if (!uploadQueue) return;
    
    const isAlbum = AppState.uploadType === 'album';
    let albumMetadata = null;
    
    for (const file of AppState.pendingFiles) {
        if (!file.type.startsWith('audio/')) {
            showToast('Only audio files are supported', 'error');
            continue;
        }
        
        const uploadItem = createUploadItem(file);
        uploadQueue.appendChild(uploadItem);
        
        try {
            await processAudioFile(file, uploadItem, isAlbum, albumMetadata);
        } catch (error) {
            console.error('Error processing file:', error);
            showToast(`Error processing ${file.name}`, 'error');
            uploadItem.remove();
        }
    }
    
    AppState.pendingFiles = [];
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

async function processAudioFile(file, uploadItem, isAlbum = false, sharedAlbumMetadata = null) {
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
                    dateAdded: new Date().toISOString(),
                    isFavorite: false,
                    lyrics: null,
                    syncedLyrics: false
                };
                
                // Check for duplicates
                const isDuplicate = AppState.songs.some(existingSong => 
                    existingSong.title === song.title && 
                    existingSong.artist === song.artist &&
                    existingSong.album === song.album
                );
                
                if (isDuplicate) {
                    statusText.textContent = 'Duplicate - Skipped';
                    setTimeout(() => uploadItem.remove(), 1000);
                    showToast(`Skipped duplicate: ${song.title}`, 'error');
                    resolve();
                    return;
                }
                
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
                        dateAdded: new Date().toISOString(),
                        isFavorite: false,
                        lyrics: null,
                        syncedLyrics: false
                    };
                    
                    // Check for duplicates
                    const isDuplicate = AppState.songs.some(existingSong => 
                        existingSong.title === song.title && 
                        existingSong.artist === song.artist
                    );
                    
                    if (isDuplicate) {
                        progressFill.style.width = '100%';
                        statusText.textContent = 'Duplicate - Skipped';
                        setTimeout(() => uploadItem.remove(), 1000);
                        showToast(`Skipped duplicate: ${song.title}`, 'error');
                        resolve();
                        return;
                    }
                    
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
        const songItem = createSongElement(song, index);
        songsList.appendChild(songItem);
    });
}

function createSongElement(song, index) {
    const songItem = document.createElement('div');
    songItem.className = 'song-item';
    songItem.dataset.songId = song.id;
    songItem.innerHTML = `
        <div class="song-number">${index + 1}</div>
        <div class="song-info">
            <img class="song-artwork" src="${song.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E'}" alt="" crossorigin="anonymous">
            <div class="song-text">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
        </div>
        <div class="song-album">${escapeHtml(song.album)}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <div class="song-actions">
            <button class="action-icon-btn favorite-btn ${song.isFavorite ? 'favorite' : ''}" data-id="${song.id}" title="${song.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="${song.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M9 3l2 4h5l-3.5 3 1.5 5-5-3-5 3 1.5-5L1 7h5l2-4z"/>
                </svg>
            </button>
            <button class="action-icon-btn download-btn" data-id="${song.id}" title="Download">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M9 2v10m-4-4l4 4 4-4M2 14v2h14v-2"/>
                </svg>
            </button>
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
    
    const favoriteBtn = songItem.querySelector('.favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(song.id);
        });
    }
    
    const downloadBtn = songItem.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadSong(song.id);
        });
    }
    
    const deleteBtn = songItem.querySelector('.delete-song-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSong(song.id);
        });
    }
    
    return songItem;
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
        albumCard.dataset.albumId = album.id;
        albumCard.innerHTML = `
            <img class="album-artwork" src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" alt="" crossorigin="anonymous">
            <div class="album-info">
                <h3 contenteditable="false" class="album-title" data-album-id="${album.id}">${escapeHtml(album.title)}</h3>
                <p>${escapeHtml(album.artist)}</p>
                <div class="album-meta">${album.year || 'Unknown Year'} • ${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}</div>
            </div>
        `;
        
        albumCard.addEventListener('click', (e) => {
            if (!e.target.classList.contains('album-title')) {
                showAlbumDetail(album);
            }
        });
        
        // Double click to rename
        const albumTitle = albumCard.querySelector('.album-title');
        albumTitle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            albumTitle.contentEditable = 'true';
            albumTitle.focus();
            document.execCommand('selectAll', false, null);
        });
        
        albumTitle.addEventListener('blur', function() {
            this.contentEditable = 'false';
            const newTitle = this.textContent.trim();
            if (newTitle && newTitle !== album.title) {
                renameAlbum(album.id, newTitle);
            } else {
                this.textContent = album.title;
            }
        });
        
        albumTitle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
            if (e.key === 'Escape') {
                this.textContent = album.title;
                this.blur();
            }
        });
        
        albumsGrid.appendChild(albumCard);
    });
}

function renderFavorites() {
    const favoritesList = document.getElementById('favorites-list');
    const favoritesEmpty = document.getElementById('favorites-empty');
    const favoritesCount = document.getElementById('favorites-count');
    
    if (!favoritesList) return;
    
    const favorites = AppState.songs.filter(song => song.isFavorite);
    
    if (favorites.length === 0) {
        favoritesList.style.display = 'none';
        if (favoritesEmpty) favoritesEmpty.style.display = 'block';
        if (favoritesCount) favoritesCount.textContent = '0 tracks';
        return;
    }
    
    favoritesList.style.display = 'flex';
    if (favoritesEmpty) favoritesEmpty.style.display = 'none';
    if (favoritesCount) favoritesCount.textContent = `${favorites.length} track${favorites.length === 1 ? '' : 's'}`;
    
    favoritesList.innerHTML = '';
    
    favorites.forEach((song, index) => {
        const songIndex = AppState.songs.findIndex(s => s.id === song.id);
        const songItem = createSongElement(song, songIndex);
        favoritesList.appendChild(songItem);
    });
}

function showAlbumDetail(album) {
    const detailView = document.getElementById('album-detail-view');
    const detailContent = document.getElementById('album-detail-content');
    
    if (!detailView || !detailContent) return;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    detailView.classList.add('active');
    
    detailContent.innerHTML = `
        <div style="display: flex; gap: 2.5rem; margin-bottom: 3rem; align-items: flex-start;">
            <div style="position: relative;">
                <img src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" 
                     style="width: 220px; height: 220px; border-radius: var(--radius-lg); object-fit: cover; box-shadow: var(--shadow-lg);" alt="" crossorigin="anonymous">
                <button class="btn-secondary" style="margin-top: 1rem; width: 100%;" onclick="changeAlbumArtwork('${album.id}')">Change Cover</button>
            </div>
            <div style="flex: 1;">
                <h2 style="font-size: 3rem; margin-bottom: 0.75rem; font-weight: 700;">${escapeHtml(album.title)}</h2>
                <p style="font-size: 1.3rem; color: var(--text-secondary); margin-bottom: 1rem;">${escapeHtml(album.artist)}</p>
                <p style="color: var(--text-muted); font-size: 1.05rem; margin-bottom: 1.5rem;">${album.year || 'Unknown Year'} • ${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}</p>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-primary" onclick="playAlbum('${album.id}')">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="display: inline; margin-right: 0.5rem;">
                            <path d="M6 4v12l10-6z"/>
                        </svg>
                        Play Album
                    </button>
                    <button class="btn-secondary" onclick="shareAlbum('${album.id}')">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="display: inline; margin-right: 0.5rem;">
                            <path d="M15 5a2 2 0 100-4 2 2 0 000 4zM5 12a2 2 0 100-4 2 2 0 000 4zm10 5a2 2 0 100-4 2 2 0 000 4zM6.5 11l7-3M6.5 11l7 3"/>
                        </svg>
                        Share
                    </button>
                    <button class="btn-secondary" onclick="addTracksToAlbum('${album.id}')">Add Tracks</button>
                </div>
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

window.shareAlbum = function(albumId) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    const shareText = `Check out "${album.title}" by ${album.artist} - ${album.tracks.length} tracks!`;
    
    if (navigator.share) {
        navigator.share({
            title: album.title,
            text: shareText
        }).catch(err => console.log('Share failed:', err));
    } else {
        navigator.clipboard.writeText(shareText);
        showToast('Album info copied to clipboard!', 'success');
    }
};

window.addTracksToAlbum = function(albumId) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    
    input.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;
        
        showToast(`Adding ${files.length} track(s) to ${album.title}...`, 'success');
        
        for (const file of files) {
            // Process and add to album
            // This would need special handling to ensure tracks go to the right album
            await processAudioFile(file, createUploadItem(file), true);
        }
    });
    
    input.click();
};

window.changeAlbumArtwork = function(albumId) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const artworkURL = event.target.result;
            
            // Update album artwork
            album.artwork = artworkURL;
            
            // Update all tracks in the album
            album.tracks.forEach(track => {
                track.artwork = artworkURL;
            });
            
            saveToStorage();
            showAlbumDetail(album);
            renderCurrentView();
            showToast('Album artwork updated!', 'success');
        };
        reader.readAsDataURL(file);
    });
    
    input.click();
};

function renameAlbum(albumId, newTitle) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    album.title = newTitle;
    
    // Update all tracks in the album
    album.tracks.forEach(track => {
        track.album = newTitle;
    });
    
    saveToStorage();
    renderAlbums();
    showToast('Album renamed!', 'success');
}

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
    const favoritePlayerBtn = document.getElementById('favorite-player-btn');
    
    if (!audioPlayer || !player) return;
    
    audioPlayer.src = AppState.currentTrack.url;
    
    if (playerArtwork) {
        playerArtwork.src = AppState.currentTrack.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E';
        playerArtwork.crossOrigin = 'anonymous';
        
        // Extract colors and update background
        if (AppState.currentTrack.artwork) {
            playerArtwork.addEventListener('load', () => {
                try {
                    const color = AppState.colorThief.getColor(playerArtwork);
                    updateDynamicBackground(color);
                } catch (e) {
                    console.log('Could not extract color:', e);
                }
            });
        }
    }
    
    if (playerTitle) playerTitle.textContent = AppState.currentTrack.title;
    if (playerArtist) playerArtist.textContent = AppState.currentTrack.artist;
    
    // Update favorite button
    if (favoritePlayerBtn) {
        if (AppState.currentTrack.isFavorite) {
            favoritePlayerBtn.classList.add('active');
        } else {
            favoritePlayerBtn.classList.remove('active');
        }
    }
    
    player.classList.remove('hidden');
    
    audioPlayer.play().then(() => {
        AppState.isPlaying = true;
        updatePlayPauseButton();
    }).catch(error => {
        console.error('Playback error:', error);
        showToast('Error playing track', 'error');
    });
}

function updateDynamicBackground(rgbColor) {
    const dynamicBg = document.getElementById('dynamic-bg');
    if (!dynamicBg) return;
    
    const [r, g, b] = rgbColor;
    const gradient = `
        radial-gradient(circle at 20% 50%, rgba(${r}, ${g}, ${b}, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(${r}, ${g}, ${b}, 0.1) 0%, transparent 50%)
    `;
    
    dynamicBg.style.background = `linear-gradient(135deg, var(--bg-primary) 0%, rgba(${r}, ${g}, ${b}, 0.05) 100%)`;
    dynamicBg.classList.add('active');
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
    
    // Update synced lyrics
    updateSyncedLyrics(audioPlayer.currentTime);
}

// ===================================
// FAVORITES
// ===================================
function toggleFavorite(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    song.isFavorite = !song.isFavorite;
    saveToStorage();
    
    // Update UI
    renderCurrentView();
    
    // Update player button if this is the current track
    if (AppState.currentTrack && AppState.currentTrack.id === songId) {
        const favoritePlayerBtn = document.getElementById('favorite-player-btn');
        if (favoritePlayerBtn) {
            favoritePlayerBtn.classList.toggle('active', song.isFavorite);
        }
    }
    
    showToast(song.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
}

// ===================================
// DOWNLOAD
// ===================================
function downloadSong(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song || !song.file) return;
    
    const url = URL.createObjectURL(song.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.artist} - ${song.title}.${song.file.name.split('.').pop()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Downloading: ${song.title}`, 'success');
}

// ===================================
// LYRICS
// ===================================
function showLyricsModal() {
    if (!AppState.currentTrack) return;
    
    const modal = document.getElementById('lyrics-modal');
    const lyricsDisplay = document.getElementById('lyrics-display');
    
    if (!modal || !lyricsDisplay) return;
    
    if (AppState.currentTrack.lyrics) {
        if (AppState.currentTrack.syncedLyrics) {
            lyricsDisplay.classList.add('synced');
            lyricsDisplay.innerHTML = parseSyncedLyrics(AppState.currentTrack.lyrics);
        } else {
            lyricsDisplay.classList.remove('synced');
            lyricsDisplay.innerHTML = `<pre>${escapeHtml(AppState.currentTrack.lyrics)}</pre>`;
        }
    } else {
        lyricsDisplay.classList.remove('synced');
        lyricsDisplay.innerHTML = '<p class="no-lyrics">No lyrics available</p>';
    }
    
    modal.classList.add('active');
}

function closeLyricsModal() {
    const modal = document.getElementById('lyrics-modal');
    if (modal) modal.classList.remove('active');
}

window.closeLyricsModal = closeLyricsModal;

function editLyrics() {
    closeLyricsModal();
    
    const modal = document.getElementById('edit-lyrics-modal');
    const textarea = document.getElementById('lyrics-textarea');
    const syncedToggle = document.getElementById('synced-lyrics-toggle');
    
    if (!modal || !textarea) return;
    
    if (AppState.currentTrack) {
        textarea.value = AppState.currentTrack.lyrics || '';
        if (syncedToggle) syncedToggle.checked = AppState.currentTrack.syncedLyrics || false;
    }
    
    modal.classList.add('active');
}

window.editLyrics = editLyrics;

function closeEditLyricsModal() {
    const modal = document.getElementById('edit-lyrics-modal');
    if (modal) modal.classList.remove('active');
}

window.closeEditLyricsModal = closeEditLyricsModal;

function saveLyrics() {
    if (!AppState.currentTrack) return;
    
    const textarea = document.getElementById('lyrics-textarea');
    const syncedToggle = document.getElementById('synced-lyrics-toggle');
    
    if (!textarea) return;
    
    const lyrics = textarea.value.trim();
    const isSynced = syncedToggle ? syncedToggle.checked : false;
    
    AppState.currentTrack.lyrics = lyrics || null;
    AppState.currentTrack.syncedLyrics = isSynced && lyrics;
    
    saveToStorage();
    closeEditLyricsModal();
    showToast('Lyrics saved!', 'success');
}

window.saveLyrics = saveLyrics;

function parseSyncedLyrics(lyrics) {
    const lines = lyrics.split('\n');
    let html = '';
    
    lines.forEach((line, index) => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)/);
        if (match) {
            const [, minutes, seconds, centiseconds, text] = match;
            const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
            html += `<div class="lyric-line" data-time="${timestamp}">${escapeHtml(text)}</div>`;
        } else if (line.trim()) {
            html += `<div class="lyric-line">${escapeHtml(line)}</div>`;
        }
    });
    
    return html || '<p class="no-lyrics">No lyrics available</p>';
}

function updateSyncedLyrics(currentTime) {
    const lyricsDisplay = document.getElementById('lyrics-display');
    if (!lyricsDisplay || !lyricsDisplay.classList.contains('synced')) return;
    
    const lines = lyricsDisplay.querySelectorAll('.lyric-line[data-time]');
    let activeIndex = -1;
    
    lines.forEach((line, index) => {
        const time = parseFloat(line.dataset.time);
        if (currentTime >= time) {
            activeIndex = index;
        }
    });
    
    lines.forEach((line, index) => {
        line.classList.toggle('active', index === activeIndex);
    });
    
    // Scroll to active line
    if (activeIndex >= 0 && lines[activeIndex]) {
        lines[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ===================================
// CONTEXT MENU
// ===================================
function showContextMenu(event, target) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    
    AppState.contextMenuTarget = target;
    
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.classList.add('active');
    
    // Setup menu item handlers
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.onclick = () => handleContextMenuAction(item.dataset.action);
    });
    
    event.preventDefault();
}

function closeContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
        menu.classList.remove('active');
    }
    AppState.contextMenuTarget = null;
}

function handleContextMenuAction(action) {
    const target = AppState.contextMenuTarget;
    if (!target) return;
    
    const songId = target.dataset.songId;
    const albumId = target.dataset.albumId;
    
    switch (action) {
        case 'play':
            if (songId) {
                const index = AppState.songs.findIndex(s => s.id === songId);
                if (index >= 0) playSong(index);
            } else if (albumId) {
                playAlbum(albumId);
            }
            break;
        case 'favorite':
            if (songId) toggleFavorite(songId);
            break;
        case 'download':
            if (songId) downloadSong(songId);
            break;
        case 'share':
            if (songId) {
                const song = AppState.songs.find(s => s.id === songId);
                if (song) {
                    const shareText = `Check out "${song.title}" by ${song.artist}!`;
                    if (navigator.share) {
                        navigator.share({ title: song.title, text: shareText });
                    } else {
                        navigator.clipboard.writeText(shareText);
                        showToast('Song info copied to clipboard!', 'success');
                    }
                }
            } else if (albumId) {
                shareAlbum(albumId);
            }
            break;
        case 'lyrics':
            if (songId) {
                const song = AppState.songs.find(s => s.id === songId);
                if (song) {
                    AppState.currentTrack = song;
                    editLyrics();
                }
            }
            break;
        case 'artwork':
            if (songId) {
                changeSongArtwork(songId);
            } else if (albumId) {
                changeAlbumArtwork(albumId);
            }
            break;
        case 'delete':
            if (songId) deleteSong(songId);
            break;
    }
    
    closeContextMenu();
}

function changeSongArtwork(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            song.artwork = event.target.result;
            saveToStorage();
            renderCurrentView();
            showToast('Song artwork updated!', 'success');
        };
        reader.readAsDataURL(file);
    });
    
    input.click();
}

// ===================================
// SEARCH & SORT
// ===================================
function filterContent(searchTerm) {
    const term = searchTerm.toLowerCase();
    const activeView = document.querySelector('.view.active');
    
    if (!activeView) return;
    
    if (activeView.id === 'songs-view' || activeView.id === 'favorites-view') {
        const songItems = activeView.querySelectorAll('.song-item');
        songItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'grid' : 'none';
        });
    } else if (activeView.id === 'albums-view') {
        const albumCards = activeView.querySelectorAll('.album-card');
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
        dateAdded: song.dateAdded,
        isFavorite: song.isFavorite,
        lyrics: song.lyrics,
        syncedLyrics: song.syncedLyrics
    }));
    
    try {
        localStorage.setItem('musicvault_songs', JSON.stringify(songsToSave));
        localStorage.setItem('musicvault_albums_order', JSON.stringify(Object.keys(AppState.albums)));
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
