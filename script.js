// ===================================
// SUPABASE CONFIGURATION
// ===================================
const SUPABASE_URL = 'https://xarkfpnknrrlbragmrcl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcmtmcG5rbnJybGJyYWdtcmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjM5ODMsImV4cCI6MjA4NTYzOTk4M30.5akqqycJUOmpoON2adRwogq_0NmzsiJp7fb3CDb53aQ';

// Supabase client (initialized later when CDN script is available)
let supabaseClient = null;

// Initialize Supabase safely — wait/poll for the CDN-provided `window.supabase`
async function initSupabase() {
    if (supabaseClient) return;

    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    // If the SDK is already present, create client immediately
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return;
    }

    // Poll for a short time for the SDK to load (5s)
    const maxAttempts = 50; // 50 * 100ms = 5s
    for (let i = 0; i < maxAttempts; i++) {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return;
        }
        await wait(100);
    }

    // If we get here, the Supabase SDK isn't available — throw so caller can handle it
    throw new Error('Supabase client SDK not found (window.supabase). Make sure the CDN script is loaded before this script or increase the wait time.');
}

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
    colorThief: null,
    currentUser: null
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
document.addEventListener('DOMContentLoaded', async () => {
    AppState.colorThief = new ColorThief();
    
    // Initialize Supabase client (wait for SDK)
    try {
        await initSupabase();
    } catch (err) {
        console.error('Supabase init failed:', err);
        showToast('Storage service unavailable - data will not persist', 'error');
    }

    // Set up anonymous/local user immediately
    initializeUser();
    
    setupEventListeners();
    renderCurrentView();
    updateStorageInfo();
    setupDragAndDrop();
});

// ===================================
// USER INITIALIZATION (NO AUTH)
// ===================================
function initializeUser() {
    // Generate or retrieve a persistent local user ID
    let userId = localStorage.getItem('musicvault_user_id');
    if (!userId) {
        userId = 'user_' + generateId();
        localStorage.setItem('musicvault_user_id', userId);
    }
    
    AppState.currentUser = {
        id: userId,
        email: 'local@musicvault.app'
    };

    // Load user's library from Supabase
    if (supabaseClient) {
        loadFromSupabase().catch(err => {
            console.warn('Failed to load from Supabase:', err);
        });
    }
}

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
                const newOrder = [];
                const gridItems = albumsGrid.querySelectorAll('.album-card');
                gridItems.forEach(item => {
                    const albumId = item.dataset.albumId;
                    if (albumId && AppState.albums[albumId]) {
                        newOrder.push(AppState.albums[albumId]);
                    }
                });
                
                const newAlbums = {};
                newOrder.forEach(album => {
                    newAlbums[album.id] = album;
                });
                AppState.albums = newAlbums;
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
// FILE UPLOAD & SUPABASE STORAGE
// ===================================
async function handleFiles(files) {
    if (files.length === 0) return;
    
    AppState.pendingFiles = Array.from(files);
    
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
    
    for (const file of AppState.pendingFiles) {
        if (!file.type.startsWith('audio/')) {
            showToast('Only audio files are supported', 'error');
            continue;
        }
        
        const uploadItem = createUploadItem(file);
        uploadQueue.appendChild(uploadItem);
        
        try {
            await processAudioFile(file, uploadItem, isAlbum);
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

async function processAudioFile(file, uploadItem, isAlbum = false) {
    return new Promise((resolve, reject) => {
        const progressFill = uploadItem.querySelector('.upload-progress-fill');
        const statusText = uploadItem.querySelector('p');
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 70) progress = 70;
            progressFill.style.width = progress + '%';
        }, 200);
        
        window.jsmediatags.read(file, {
            onSuccess: async (tag) => {
                try {
                    clearInterval(progressInterval);
                    progressFill.style.width = '75%';
                    statusText.textContent = 'Uploading to cloud...';
                    
                    const metadata = tag.tags;
                    const tempAudioURL = URL.createObjectURL(file);
                    
                    // Get duration
                    const audio = new Audio(tempAudioURL);
                    await new Promise(res => {
                        audio.addEventListener('loadedmetadata', res);
                    });
                    
                    const songId = generateId();
                    
                    // Upload audio file to Supabase Storage
                    const audioFileName = `${AppState.currentUser.id}/${songId}.mp3`;
                    const { data: audioData, error: audioError } = await supabaseClient.storage
                        .from('music-files')
                        .upload(audioFileName, file);
                    
                    if (audioError) throw audioError;
                    
                    progressFill.style.width = '85%';
                    
                    // Get public URL for audio
                    const { data: { publicUrl: audioURL } } = supabaseClient.storage
                        .from('music-files')
                        .getPublicUrl(audioFileName);
                    
                    // Upload artwork if exists
                    let artworkURL = null;
                    if (metadata.picture) {
                        const { data, format } = metadata.picture;
                        const blob = new Blob([new Uint8Array(data)], { type: format });
                        
                        const artworkFileName = `${AppState.currentUser.id}/${songId}-artwork.jpg`;
                        const { error: artworkError } = await supabaseClient.storage
                            .from('music-files')
                            .upload(artworkFileName, blob);
                        
                        if (!artworkError) {
                            const { data: { publicUrl } } = supabaseClient.storage
                                .from('music-files')
                                .getPublicUrl(artworkFileName);
                            artworkURL = publicUrl;
                        }
                    }
                    
                    progressFill.style.width = '95%';
                    statusText.textContent = 'Saving metadata...';
                    
                    const song = {
                        id: songId,
                        user_id: AppState.currentUser.id,
                        title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
                        artist: metadata.artist || 'Unknown Artist',
                        album: metadata.album || 'Unknown Album',
                        year: metadata.year || '',
                        track: metadata.track || '',
                        duration: audio.duration,
                        audio_url: audioURL,
                        artwork_url: artworkURL,
                        is_favorite: false,
                        lyrics: null,
                        synced_lyrics: false
                    };
                    
                    // Save to Supabase database
                    const { error: dbError } = await supabaseClient
                        .from('songs')
                        .insert([song]);
                    
                    if (dbError) throw dbError;
                    
                    // Add to local state
                    AppState.songs.push({
                        ...song,
                        dateAdded: new Date().toISOString()
                    });
                    
                    organizeAlbums();
                    
                    progressFill.style.width = '100%';
                    statusText.textContent = 'Complete!';
                    
                    setTimeout(() => {
                        uploadItem.remove();
                        renderCurrentView();
                        updateStorageInfo();
                        showToast(`Added: ${song.title}`, 'success');
                    }, 500);
                    
                    resolve();
                } catch (error) {
                    clearInterval(progressInterval);
                    console.error('Upload error:', error);
                    showToast('Upload failed: ' + error.message, 'error');
                    uploadItem.remove();
                    reject(error);
                }
            },
            onError: async (error) => {
                clearInterval(progressInterval);
                console.log('Metadata extraction failed, using basic info:', error);
                
                try {
                    const tempAudioURL = URL.createObjectURL(file);
                    const audio = new Audio(tempAudioURL);
                    
                    await new Promise(res => {
                        audio.addEventListener('loadedmetadata', res);
                    });
                    
                    const songId = generateId();
                    
                    statusText.textContent = 'Uploading to cloud...';
                    progressFill.style.width = '50%';
                    
                    // Upload audio file
                    const audioFileName = `${AppState.currentUser.id}/${songId}.mp3`;
                    const { data: audioData, error: audioError } = await supabaseClient.storage
                        .from('music-files')
                        .upload(audioFileName, file);
                    
                    if (audioError) throw audioError;
                    
                    const { data: { publicUrl: audioURL } } = supabaseClient.storage
                        .from('music-files')
                        .getPublicUrl(audioFileName);
                    
                    progressFill.style.width = '90%';
                    
                    const song = {
                        id: songId,
                        user_id: AppState.currentUser.id,
                        title: file.name.replace(/\.[^/.]+$/, ''),
                        artist: 'Unknown Artist',
                        album: 'Unknown Album',
                        year: '',
                        track: '',
                        duration: audio.duration,
                        audio_url: audioURL,
                        artwork_url: null,
                        is_favorite: false,
                        lyrics: null,
                        synced_lyrics: false
                    };
                    
                    const { error: dbError } = await supabaseClient
                        .from('songs')
                        .insert([song]);
                    
                    if (dbError) throw dbError;
                    
                    AppState.songs.push({
                        ...song,
                        dateAdded: new Date().toISOString()
                    });
                    
                    organizeAlbums();
                    
                    progressFill.style.width = '100%';
                    statusText.textContent = 'Complete!';
                    
                    setTimeout(() => {
                        uploadItem.remove();
                        renderCurrentView();
                        updateStorageInfo();
                        showToast(`Added: ${song.title}`, 'success');
                    }, 500);
                    
                    resolve();
                } catch (uploadError) {
                    console.error('Upload error:', uploadError);
                    showToast('Upload failed', 'error');
                    uploadItem.remove();
                    reject(uploadError);
                }
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
                artwork: song.artwork_url,
                tracks: []
            };
        }
        
        AppState.albums[albumKey].tracks.push(song);
        
        if (song.artwork_url && !AppState.albums[albumKey].artwork) {
            AppState.albums[albumKey].artwork = song.artwork_url;
        }
    });
    
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
            <div class="song-artwork-container" title="Click to change cover art">
                <img class="song-artwork" src="${song.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E'}" alt="" crossorigin="anonymous">
                <div class="song-artwork-overlay-small">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                        <path d="M2 2h16v16H2V2zm3 3v9l3-3 3 3 3-3V5H5zm9 0h3v3h-3V5z"/>
                        <path d="M10 8l-3 3h2v4h2v-4h2l-3-3z"/>
                    </svg>
                </div>
            </div>
            <div class="song-text">
                <div class="song-title" contenteditable="false" data-song-id="${song.id}" title="Double-click to edit">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
        </div>
        <div class="song-album">${escapeHtml(song.album)}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <div class="song-actions">
            <button class="action-icon-btn favorite-btn ${song.is_favorite ? 'favorite' : ''}" data-id="${song.id}" title="${song.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="${song.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
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
    
    // Double-click to edit song title
    const songTitle = songItem.querySelector('.song-title');
    songTitle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        songTitle.contentEditable = 'true';
        songTitle.focus();
        document.execCommand('selectAll', false, null);
    });
    
    songTitle.addEventListener('blur', async function() {
        this.contentEditable = 'false';
        const newTitle = this.textContent.trim();
        if (newTitle && newTitle !== song.title) {
            await updateSongTitle(song.id, newTitle);
        } else {
            this.textContent = song.title;
        }
    });
    
    songTitle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
        if (e.key === 'Escape') {
            this.textContent = song.title;
            this.blur();
        }
    });
    
    const artworkContainer = songItem.querySelector('.song-artwork-container');
    artworkContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        changeSongArtwork(song.id);
    });
    
    songItem.addEventListener('click', (e) => {
        if (!e.target.closest('.action-icon-btn') && !e.target.closest('.song-artwork-container') && !e.target.classList.contains('song-title')) {
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

async function updateSongTitle(songId, newTitle) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    const { error } = await supabaseClient
        .from('songs')
        .update({ title: newTitle })
        .eq('id', songId);
    
    if (error) {
        showToast('Failed to update song title', 'error');
        return;
    }
    
    song.title = newTitle;
    organizeAlbums();
    renderCurrentView();
    showToast('Song title updated!', 'success');
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
            <div style="position: relative; cursor: pointer;" class="album-artwork-container">
                <img class="album-artwork" src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" alt="" crossorigin="anonymous">
                <div class="album-artwork-overlay">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="white">
                        <path d="M4 4h24v24H4V4zm4 4v12l4-4 4 4 4-4V8H8zm12 0h4v4h-4V8z"/>
                        <path d="M16 12l-4 4h2.5v5h3v-5H20l-4-4z"/>
                    </svg>
                </div>
            </div>
            <div class="album-info">
                <h3 contenteditable="false" class="album-title" data-album-id="${album.id}">${escapeHtml(album.title)}</h3>
                <p>${escapeHtml(album.artist)}</p>
                <div class="album-meta">${album.year || 'Unknown Year'} • ${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}</div>
            </div>
        `;
        
        const artworkContainer = albumCard.querySelector('.album-artwork-container');
        artworkContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            changeAlbumArtwork(album.id);
        });
        
        albumCard.addEventListener('click', (e) => {
            if (!e.target.closest('.album-artwork-container') && !e.target.classList.contains('album-title')) {
                showAlbumDetail(album);
            }
        });
        
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
    
    const favorites = AppState.songs.filter(song => song.is_favorite);
    
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
            <div style="position: relative; cursor: pointer;" onclick="changeAlbumArtwork('${album.id}')" title="Click to change cover art">
                <img src="${album.artwork || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'%3E%3Crect fill=\'%23282828\' width=\'200\' height=\'200\'/%3E%3C/svg%3E'}" 
                     style="width: 220px; height: 220px; border-radius: var(--radius-lg); object-fit: cover; box-shadow: var(--shadow-lg); transition: transform 0.3s ease;" 
                     onmouseover="this.style.transform='scale(1.02)'" 
                     onmouseout="this.style.transform='scale(1)'" 
                     alt="" crossorigin="anonymous">
                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="white" style="pointer-events: none;">
                        <path d="M6 6h36v36H6V6zm6 6v18l6-6 6 6 6-6v-12H12zm18 0h6v6h-6v-6z"/>
                        <path d="M24 18l-6 6h4v8h4v-8h4l-6-6z"/>
                    </svg>
                </div>
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
            songItem.dataset.songId = song.id;
            songItem.innerHTML = `
                <div class="song-number">${song.track || index + 1}</div>
                <div class="song-info">
                    <div class="song-text">
                        <div class="song-title" contenteditable="false" data-song-id="${song.id}" title="Double-click to edit">${escapeHtml(song.title)}</div>
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
            
            // Double-click to edit song title in album view
            const songTitle = songItem.querySelector('.song-title');
            songTitle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                songTitle.contentEditable = 'true';
                songTitle.focus();
                document.execCommand('selectAll', false, null);
            });
            
            songTitle.addEventListener('blur', async function() {
                this.contentEditable = 'false';
                const newTitle = this.textContent.trim();
                if (newTitle && newTitle !== song.title) {
                    await updateSongTitle(song.id, newTitle);
                    showAlbumDetail(album); // Refresh album view
                } else {
                    this.textContent = song.title;
                }
            });
            
            songTitle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
                if (e.key === 'Escape') {
                    this.textContent = song.title;
                    this.blur();
                }
            });
            
            songItem.addEventListener('click', (e) => {
                if (!e.target.closest('.action-icon-btn') && !e.target.classList.contains('song-title')) {
                    const songIndex = AppState.songs.findIndex(s => s.id === song.id);
                    if (songIndex !== -1) playSong(songIndex);
                }
            });
            
            // Delete button with options
            const deleteBtn = songItem.querySelector('.delete-song-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDeleteOptions(song.id, album.id);
                });
            }
            
            tracksList.appendChild(songItem);
        });
    }
}

function showDeleteOptions(songId, albumId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <h2>Delete Song</h2>
            <p style="margin-bottom: 1.5rem;">What would you like to do?</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <button class="btn-secondary" onclick="removeFromAlbum('${songId}', '${albumId}'); this.closest('.modal').remove();">
                    Remove from this album only
                </button>
                <button class="btn-secondary" style="background: var(--accent-secondary); color: white; border-color: var(--accent-secondary);" onclick="deleteSong('${songId}'); this.closest('.modal').remove();">
                    Delete song entirely
                </button>
                <button class="btn-secondary" onclick="this.closest('.modal').remove();">
                    Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.removeFromAlbum = async function(songId, albumId) {
    // In this app, songs aren't actually in albums - they're organized by metadata
    // So "removing from album" means changing the album metadata
    showToast('Feature coming soon: Move song to different album', 'error');
};

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
        handleFiles(files);
    });
    
    input.click();
};

window.changeAlbumArtwork = async function(albumId) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            // Upload to Supabase Storage
            const artworkFileName = `${AppState.currentUser.id}/album-${albumId}-artwork.jpg`;
            const { error: uploadError } = await supabaseClient.storage
                .from('music-files')
                .upload(artworkFileName, file, { upsert: true });
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabaseClient.storage
                .from('music-files')
                .getPublicUrl(artworkFileName);
            
            // Update all tracks in the album
            const updatePromises = album.tracks.map(track => 
                supabaseClient
                    .from('songs')
                    .update({ artwork_url: publicUrl })
                    .eq('id', track.id)
            );
            
            await Promise.all(updatePromises);
            
            // Update local state
            album.artwork = publicUrl;
            album.tracks.forEach(track => {
                track.artwork_url = publicUrl;
            });
            
            showAlbumDetail(album);
            renderCurrentView();
            showToast('Album artwork updated!', 'success');
        } catch (error) {
            console.error('Error updating artwork:', error);
            showToast('Failed to update artwork', 'error');
        }
    });
    
    input.click();
};

async function renameAlbum(albumId, newTitle) {
    const album = AppState.albums[albumId];
    if (!album) return;
    
    try {
        // Update all tracks in the album
        const updatePromises = album.tracks.map(track => 
            supabaseClient
                .from('songs')
                .update({ album: newTitle })
                .eq('id', track.id)
        );
        
        await Promise.all(updatePromises);
        
        album.title = newTitle;
        album.tracks.forEach(track => {
            track.album = newTitle;
        });
        
        organizeAlbums();
        renderAlbums();
        showToast('Album renamed!', 'success');
    } catch (error) {
        console.error('Error renaming album:', error);
        showToast('Failed to rename album', 'error');
    }
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
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.sidebar');
    
    if (!audioPlayer || !player) return;
    
    if (!AppState.currentTrack.audio_url) {
        showToast('Cannot play this track - file not found', 'error');
        return;
    }
    
    audioPlayer.src = AppState.currentTrack.audio_url;
    
    if (playerArtwork) {
        playerArtwork.src = AppState.currentTrack.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23282828\' width=\'100\' height=\'100\'/%3E%3C/svg%3E';
        playerArtwork.crossOrigin = 'anonymous';
        
        if (AppState.currentTrack.artwork_url) {
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
    
    if (favoritePlayerBtn) {
        if (AppState.currentTrack.is_favorite) {
            favoritePlayerBtn.classList.add('active');
        } else {
            favoritePlayerBtn.classList.remove('active');
        }
    }
    
    player.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('player-active');
    if (sidebar) sidebar.classList.add('player-active');
    
    audioPlayer.play().then(() => {
        AppState.isPlaying = true;
        updatePlayPauseButton();
        
        // Record listening history
        recordListeningHistory(AppState.currentTrack.id);
    }).catch(error => {
        console.error('Playback error:', error);
        showToast('Error playing track', 'error');
    });
}

async function recordListeningHistory(songId) {
    if (!AppState.currentUser || !supabaseClient) return;
    
    await supabaseClient
        .from('listening_history')
        .insert([{
            user_id: AppState.currentUser.id,
            song_id: songId
        }]);
}

function updateDynamicBackground(rgbColor) {
    const dynamicBg = document.getElementById('dynamic-bg');
    if (!dynamicBg) return;
    
    const [r, g, b] = rgbColor;
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
    
    updateSyncedLyrics(audioPlayer.currentTime);
}

// ===================================
// FAVORITES
// ===================================
async function toggleFavorite(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    song.is_favorite = !song.is_favorite;
    
    const { error } = await supabaseClient
        .from('songs')
        .update({ is_favorite: song.is_favorite })
        .eq('id', songId);
    
    if (error) {
        showToast('Failed to update favorite', 'error');
        song.is_favorite = !song.is_favorite; // Revert
        return;
    }
    
    renderCurrentView();
    
    if (AppState.currentTrack && AppState.currentTrack.id === songId) {
        const favoritePlayerBtn = document.getElementById('favorite-player-btn');
        if (favoritePlayerBtn) {
            favoritePlayerBtn.classList.toggle('active', song.is_favorite);
        }
    }
    
    showToast(song.is_favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
}

// ===================================
// DOWNLOAD
// ===================================
function downloadSong(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song || !song.audio_url) {
        showToast('Cannot download - file not available', 'error');
        return;
    }
    
    const a = document.createElement('a');
    a.href = song.audio_url;
    a.download = `${song.artist} - ${song.title}.mp3`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
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
        if (AppState.currentTrack.synced_lyrics) {
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
        if (syncedToggle) syncedToggle.checked = AppState.currentTrack.synced_lyrics || false;
    }
    
    modal.classList.add('active');
}

window.editLyrics = editLyrics;

function closeEditLyricsModal() {
    const modal = document.getElementById('edit-lyrics-modal');
    if (modal) modal.classList.remove('active');
}

window.closeEditLyricsModal = closeEditLyricsModal;

async function saveLyrics() {
    if (!AppState.currentTrack) return;
    
    const textarea = document.getElementById('lyrics-textarea');
    const syncedToggle = document.getElementById('synced-lyrics-toggle');
    
    if (!textarea) return;
    
    const lyrics = textarea.value.trim();
    const isSynced = syncedToggle ? syncedToggle.checked : false;
    
    AppState.currentTrack.lyrics = lyrics || null;
    AppState.currentTrack.synced_lyrics = isSynced && lyrics;
    
    const { error } = await supabaseClient
        .from('songs')
        .update({
            lyrics: lyrics || null,
            synced_lyrics: isSynced && lyrics
        })
        .eq('id', AppState.currentTrack.id);
    
    if (error) {
        showToast('Failed to save lyrics', 'error');
    } else {
        closeEditLyricsModal();
        showToast('Lyrics saved!', 'success');
    }
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

async function changeSongArtwork(songId) {
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const artworkFileName = `${AppState.currentUser.id}/${songId}-artwork.jpg`;
            const { error: uploadError } = await supabaseClient.storage
                .from('music-files')
                .upload(artworkFileName, file, { upsert: true });
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabaseClient.storage
                .from('music-files')
                .getPublicUrl(artworkFileName);
            
            const { error: dbError } = await supabaseClient
                .from('songs')
                .update({ artwork_url: publicUrl })
                .eq('id', songId);
            
            if (dbError) throw dbError;
            
            song.artwork_url = publicUrl;
            organizeAlbums();
            renderCurrentView();
            showToast('Song artwork updated!', 'success');
        } catch (error) {
            console.error('Error updating artwork:', error);
            showToast('Failed to update artwork', 'error');
        }
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
            AppState.songs.sort((a, b) => new Date(b.date_added || b.dateAdded) - new Date(a.date_added || a.dateAdded));
            break;
    }
    
    renderCurrentView();
}

// ===================================
// DELETE
// ===================================
async function deleteSong(songId) {
    if (!confirm('Delete this song permanently?')) return;
    
    const song = AppState.songs.find(s => s.id === songId);
    if (!song) return;
    
    try {
        // Delete from database
        const { error: dbError } = await supabaseClient
            .from('songs')
            .delete()
            .eq('id', songId);
        
        if (dbError) throw dbError;
        
        // Delete audio file from storage
        const audioFileName = `${AppState.currentUser.id}/${songId}.mp3`;
        await supabaseClient.storage
            .from('music-files')
            .remove([audioFileName]);
        
        // Delete artwork if exists
        if (song.artwork_url) {
            const artworkFileName = `${AppState.currentUser.id}/${songId}-artwork.jpg`;
            await supabaseClient.storage
                .from('music-files')
                .remove([artworkFileName]);
        }
        
        // Remove from local state
        AppState.songs = AppState.songs.filter(s => s.id !== songId);
        organizeAlbums();
        renderCurrentView();
        updateStorageInfo();
        showToast('Song deleted', 'success');
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete song', 'error');
    }
}

window.deleteSong = deleteSong;

// ===================================
// SUPABASE STORAGE
// ===================================
async function loadFromSupabase() {
    if (!AppState.currentUser || !supabaseClient) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('songs')
            .select('*')
            .eq('user_id', AppState.currentUser.id)
            .order('date_added', { ascending: false });
        
        if (error) throw error;
        
        AppState.songs = data.map(song => ({
            ...song,
            dateAdded: song.date_added
        }));
        
        organizeAlbums();
        renderCurrentView();
        updateStorageInfo();
    } catch (error) {
        console.error('Failed to load from Supabase:', error);
        showToast('Failed to load library', 'error');
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
