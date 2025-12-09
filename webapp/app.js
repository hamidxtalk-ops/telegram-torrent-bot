/**
 * Movie Finder - Telegram Mini App
 * Persian RTL Interface with Dark Mode
 */

// ===================================
// Telegram WebApp Integration
// ===================================

const tg = window.Telegram?.WebApp;

// Initialize Telegram WebApp
function initTelegram() {
    if (tg) {
        tg.ready();
        tg.expand();

        // Apply Telegram theme
        document.body.classList.add('tg-theme');

        // Set header color
        tg.setHeaderColor('#1a1a2e');
        tg.setBackgroundColor('#0f0f1a');

        // Enable closing confirmation
        tg.enableClosingConfirmation();

        console.log('✅ Telegram WebApp initialized');
    } else {
        console.log('⚠️ Running outside Telegram');
    }
}

// ===================================
// State Management
// ===================================

const state = {
    currentView: 'home',
    searchResults: [],
    selectedMovie: null,
    isLoading: false
};

// API Base URL (same server)
const API_BASE = window.location.origin;

// ===================================
// DOM Elements
// ===================================

const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    app: document.getElementById('app'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    homeView: document.getElementById('home-view'),
    resultsView: document.getElementById('results-view'),
    movieView: document.getElementById('movie-view'),
    helpView: document.getElementById('help-view'),
    genresView: document.getElementById('genres-view'),
    genresList: document.getElementById('genres-list'),
    genresBackBtn: document.getElementById('genres-back-btn'),
    trendingMovies: document.getElementById('trending-movies'),
    searchResults: document.getElementById('search-results'),
    resultsTitle: document.getElementById('results-title'),
    backBtn: document.getElementById('back-btn'),
    movieBackBtn: document.getElementById('movie-back-btn'),
    helpBackBtn: document.getElementById('help-back-btn'),
    moviePoster: document.getElementById('movie-poster'),
    movieTitle: document.getElementById('movie-title'),
    movieYear: document.getElementById('movie-year'),
    movieRating: document.getElementById('movie-rating'),
    movieRuntime: document.getElementById('movie-runtime'),
    movieSynopsis: document.getElementById('movie-synopsis'),
    movieGenres: document.getElementById('movie-genres'),
    downloadLinks: document.getElementById('download-links'),
    toast: document.getElementById('toast'),
    navItems: document.querySelectorAll('.nav-item'),
    quickBtns: document.querySelectorAll('.quick-btn')
};

// ===================================
// View Management
// ===================================

function showView(viewName) {
    state.currentView = viewName;

    // Hide all views
    elements.homeView.classList.remove('active');
    elements.resultsView.classList.remove('active');
    elements.movieView.classList.remove('active');
    elements.helpView.classList.remove('active');
    elements.genresView.classList.remove('active');

    // Show requested view
    switch (viewName) {
        case 'home':
            elements.homeView.classList.add('active');
            break;
        case 'results':
            elements.resultsView.classList.add('active');
            break;
        case 'movie':
            elements.movieView.classList.add('active');
            break;
        case 'help':
            elements.helpView.classList.add('active');
            break;
        case 'genres':
            elements.genresView.classList.add('active');
            break;
    }

    // Update nav
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
}

// ===================================
// API Functions - with retry and timeout
// ===================================

async function apiRequest(endpoint, options = {}, retries = 2) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(tg?.initData && { 'X-Telegram-Init-Data': tg.initData })
            },
            signal: controller.signal,
            ...options
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('API Error:', error.message);

        // Retry on network errors
        if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch'))) {
            console.log(`🔄 Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
            return apiRequest(endpoint, options, retries - 1);
        }

        // Show user-friendly error
        if (error.name === 'AbortError') {
            showToast('⏱ سرعت اینترنت پایین است');
        } else {
            showToast('❌ خطا در ارتباط - دوباره تلاش کنید');
        }

        // Return empty result instead of throwing
        return { results: [], error: true };
    }
}

async function searchMovies(query) {
    if (!query.trim()) {
        showToast('لطفاً نام فیلم را وارد کنید');
        return;
    }

    state.isLoading = true;
    showLoadingSkeleton(elements.searchResults);
    showView('results');
    elements.resultsTitle.textContent = `جستجو: ${query}`;

    try {
        const data = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`);
        state.searchResults = data.results || [];

        if (state.searchResults.length === 0) {
            showEmptyState(elements.searchResults, 'نتیجه‌ای یافت نشد');
        } else {
            renderMovieGrid(elements.searchResults, state.searchResults);
        }
    } catch (error) {
        showEmptyState(elements.searchResults, 'خطا در جستجو');
    } finally {
        state.isLoading = false;
    }
}

// Search from movie detail page (when no downloads found)
async function searchFromDetail(title) {
    if (!title) return;
    elements.searchInput.value = title;
    await searchMovies(title);
}

async function getTrending() {
    showLoadingSkeleton(elements.trendingMovies);

    try {
        const data = await apiRequest('/api/trending');
        const movies = data.results || [];

        if (movies.length === 0) {
            showEmptyState(elements.trendingMovies, 'فیلمی یافت نشد');
        } else {
            renderMovieGrid(elements.trendingMovies, movies);
        }
    } catch (error) {
        showEmptyState(elements.trendingMovies, 'خطا در دریافت فیلم‌ها');
    }
}

async function getTrendingResults() {
    showLoadingSkeleton(elements.searchResults);

    try {
        const data = await apiRequest('/api/trending');
        state.searchResults = data.results || [];

        if (state.searchResults.length === 0) {
            showEmptyState(elements.searchResults, 'فیلمی یافت نشد');
        } else {
            renderMovieGrid(elements.searchResults, state.searchResults);
        }
    } catch (error) {
        showEmptyState(elements.searchResults, 'خطا در دریافت فیلم‌ها');
    }
}

async function getGenres() {
    showView('genres');

    try {
        const data = await apiRequest('/api/genres');
        const genres = data.genres || [];
        renderGenres(genres);
    } catch (error) {
        showToast('خطا در دریافت ژانرها');
    }
}

async function getByGenre(genreId, genreName) {
    showView('results');
    elements.resultsTitle.textContent = `ژانر: ${genreName}`;
    showLoadingSkeleton(elements.searchResults);

    try {
        const data = await apiRequest(`/api/genre/${genreId}`);
        state.searchResults = data.results || [];

        if (state.searchResults.length === 0) {
            showEmptyState(elements.searchResults, 'فیلمی یافت نشد');
        } else {
            renderMovieGrid(elements.searchResults, state.searchResults);
        }
    } catch (error) {
        showEmptyState(elements.searchResults, 'خطا در دریافت فیلم‌ها');
    }
}

async function getTV() {
    showView('results');
    elements.resultsTitle.textContent = '📺 سریال‌ها';
    showLoadingSkeleton(elements.searchResults);

    try {
        const data = await apiRequest('/api/tv');
        state.searchResults = data.results || [];

        if (state.searchResults.length === 0) {
            showEmptyState(elements.searchResults, 'سریالی یافت نشد');
        } else {
            renderMovieGrid(elements.searchResults, state.searchResults);
        }
    } catch (error) {
        showEmptyState(elements.searchResults, 'خطا در دریافت سریال‌ها');
    }
}

async function getAnime() {
    showView('results');
    elements.resultsTitle.textContent = '🎌 انیمه';
    showLoadingSkeleton(elements.searchResults);

    try {
        const data = await apiRequest('/api/anime');
        state.searchResults = data.results || [];

        if (state.searchResults.length === 0) {
            showEmptyState(elements.searchResults, 'انیمه‌ای یافت نشد');
        } else {
            renderMovieGrid(elements.searchResults, state.searchResults);
        }
    } catch (error) {
        showEmptyState(elements.searchResults, 'خطا در دریافت انیمه‌ها');
    }
}

async function getMovieDetails(movieId) {
    showView('movie');

    try {
        const data = await apiRequest(`/api/movie/${movieId}`);
        state.selectedMovie = data;
        renderMovieDetail(data);
    } catch (error) {
        showToast('خطا در دریافت اطلاعات فیلم');
        showView('results');
    }
}

// ===================================
// Rendering Functions
// ===================================

function renderMovieGrid(container, movies) {
    // Simple and fast rendering with native lazy loading
    container.innerHTML = movies.map((movie, index) => `
        <div class="movie-card" data-movie-id="${movie.id || index}" data-index="${index}">
            <div class="movie-card-poster">
                <img src="${movie.poster || movie.posterLarge || getPlaceholderPoster()}" 
                     alt="${escapeHtml(movie.title)}"
                     loading="lazy"
                     decoding="async"
                     onerror="this.src='${getPlaceholderPoster()}'"
                     style="width:100%;height:100%;object-fit:cover;">
                ${movie.rating ? `<span class="movie-card-rating">⭐ ${movie.rating}</span>` : ''}
            </div>
            <div class="movie-card-info">
                <div class="movie-card-title">${escapeHtml(movie.title)}</div>
                <div class="movie-card-year">${movie.year || ''}</div>
            </div>
        </div>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', async () => {
            const index = parseInt(card.dataset.index);
            const movie = movies[index];
            if (movie) {
                state.selectedMovie = movie;
                showView('movie');

                // Check if movie needs to fetch download links
                const needsLinks = !movie.torrents || movie.torrents.length === 0 || movie.sourceType === 'info';

                if (needsLinks && movie.id) {
                    // Show movie with loading state for downloads
                    renderMovieDetail({ ...movie, torrents: null, loadingLinks: true });

                    try {
                        // Fetch full details with download links
                        const data = await apiRequest(`/api/movie/${movie.id}`);
                        state.selectedMovie = { ...movie, ...data };
                        renderMovieDetail(state.selectedMovie);
                    } catch (error) {
                        console.error('Error fetching movie details:', error);
                        // Still show movie but with no links message
                        renderMovieDetail(movie);
                    }
                } else {
                    // Movie already has torrents, just render
                    renderMovieDetail(movie);
                }
            }
        });
    });
}

function renderMovieDetail(movie) {
    elements.moviePoster.style.backgroundImage = `url('${movie.posterLarge || movie.poster || getPlaceholderPoster()}')`;
    elements.movieTitle.textContent = movie.title;
    elements.movieYear.textContent = movie.year ? `📅 ${movie.year}` : '';
    elements.movieRating.textContent = movie.rating ? `⭐ ${movie.rating}` : '';
    elements.movieRuntime.textContent = movie.runtime ? `⏱ ${movie.runtime} دقیقه` : '';
    elements.movieSynopsis.textContent = movie.synopsis || movie.overview || 'توضیحات موجود نیست';

    // Genres
    const genres = movie.genres || [];
    elements.movieGenres.innerHTML = genres.map(g =>
        `<span class="genre-tag">${typeof g === 'string' ? g : g.name || g}</span>`
    ).join('');

    // Download links with type badges
    const torrents = movie.torrents;

    // Action buttons (Subtitle + Download Guide)
    let actionsHTML = `
        <div class="movie-actions">
            <button class="action-btn subtitle-btn" onclick="searchSubtitles('${escapeHtml(movie.title)}', '${movie.year || ''}')">
                📝 زیرنویس فارسی
            </button>
            <button class="action-btn guide-btn" onclick="showDownloadGuide()">
                ❓ راهنمای دانلود
            </button>
        </div>
    `;

    // Check if loading
    if (movie.loadingLinks) {
        elements.downloadLinks.innerHTML = actionsHTML + `
            <div class="loading-links">
                <div class="loading-spinner" style="width:24px;height:24px;margin:20px auto;"></div>
                <p style="text-align:center;color:var(--text-secondary);">در حال جستجوی لینک‌های دانلود...</p>
            </div>
        `;
    } else if (!torrents || torrents.length === 0) {
        // Just show action buttons, no extra message
        elements.downloadLinks.innerHTML = actionsHTML;
    } else {
        // Filter: Only Telegram and Torrent (magnet) links - no direct downloads
        const filteredTorrents = torrents.filter(torrent => {
            const isTelegramBot = torrent.isTelegramBot || (torrent.magnetLink && torrent.magnetLink.includes('t.me'));
            const isMagnet = torrent.magnetLink && torrent.magnetLink.startsWith('magnet:');

            // Allow Telegram and Magnet links only
            return isTelegramBot || isMagnet;
        });

        if (filteredTorrents.length === 0) {
            // Just show action buttons, no extra message
            elements.downloadLinks.innerHTML = actionsHTML;
        } else {
            const linksHTML = filteredTorrents.map((torrent, i) => {
                const isTelegramBot = torrent.isTelegramBot || (torrent.magnetLink && torrent.magnetLink.includes('t.me'));
                const isMagnet = torrent.magnetLink && torrent.magnetLink.startsWith('magnet:');

                // Determine link type and badge
                let typeBadge = '';
                let typeClass = '';
                if (isTelegramBot) {
                    typeBadge = '📱 تلگرام';
                    typeClass = 'type-telegram';
                } else if (isMagnet) {
                    typeBadge = '🧲 تورنت';
                    typeClass = 'type-torrent';
                }

                // For magnets, show modal with options. For Telegram, open directly
                const clickHandler = isMagnet
                    ? `onclick = "showDownloadModal('${escapeHtml(torrent.magnetLink)}', '${escapeHtml(torrent.quality || '')}', '${escapeHtml(torrent.source || '')}')"`
                    : `onclick = "handleTelegramLink(event, this)"`;

                return `
                < button ${clickHandler}
            class="download-btn ${typeClass}"
            data - link="${escapeHtml(torrent.magnetLink)}" >
                        <div class="download-info">
                            <span class="download-type-badge">${typeBadge}</span>
                            <span class="download-quality">${torrent.quality || 'نامشخص'}</span>
                            <span class="download-source">${torrent.source || 'نامشخص'}</span>
                        </div>
                        <span class="download-size">${torrent.size || ''}</span>
                    </button >
                `;
            }).join('');

            elements.downloadLinks.innerHTML = actionsHTML + linksHTML;
        }
    }
}

function showLoadingSkeleton(container, count = 6) {
    container.innerHTML = Array(count).fill(`
                < div class="movie-card skeleton" >
            <div class="movie-card-poster skeleton"></div>
            <div class="movie-card-info">
                <div class="skeleton" style="height: 16px; margin-bottom: 4px;"></div>
                <div class="skeleton" style="height: 12px; width: 50%;"></div>
            </div>
        </div >
                `).join('');
}

function showEmptyState(container, message) {
    container.innerHTML = `
                < div class="empty-state" style = "grid-column: 1 / -1;" >
            <div class="empty-state-icon">🎬</div>
            <p>${message}</p>
        </div >
                `;
}

function renderGenres(genres) {
    const genreIcons = {
        28: '💥', // Action
        35: '😂', // Comedy
        18: '🎭', // Drama
        27: '👻', // Horror
        878: '🚀', // Sci-Fi
        10749: '💕', // Romance
        53: '😱', // Thriller
        16: '🎨', // Animation
        80: '🔪', // Crime
        99: '📹' // Documentary
    };

    elements.genresList.innerHTML = genres.map(genre => `
                < div class="genre-card" data - genre - id="${genre.id}" data - genre - name="${genre.name}" >
            <span class="genre-icon">${genreIcons[genre.id] || '🎬'}</span>
            <span class="genre-name">${genre.name}</span>
        </div >
                `).join('');

    // Add click listeners
    elements.genresList.querySelectorAll('.genre-card').forEach(card => {
        card.addEventListener('click', () => {
            const genreId = card.dataset.genreId;
            const genreName = card.dataset.genreName;
            getByGenre(genreId, genreName);
        });
    });
}

// ===================================
// Utility Functions
// ===================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPlaceholderPoster() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"%3E%3Crect fill="%2316213e" width="100" height="150"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="40" x="50" y="85" text-anchor="middle"%3E🎬%3C/text%3E%3C/svg%3E';
}

function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, duration);
}

function handleTelegramLink(event, element) {
    event.preventDefault();
    const url = element.href || element.dataset.link;

    if (tg) {
        tg.openTelegramLink(url);
    } else {
        window.open(url, '_blank');
    }
}

// Download modal for torrent links - with WebTorrent support
let webTorrentClient = null;
let currentTorrent = null;

function showDownloadModal(magnetLink, quality, source) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('download-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'download-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 380px;">
                <div class="modal-header">
                    <h3>🧲 دانلود تورنت</h3>
                    <button class="modal-close" onclick="closeDownloadModal()">×</button>
                </div>
                <div class="modal-body">
                    <div id="download-modal-info" style="margin-bottom: 16px; text-align: center;">
                        <p style="font-size: 1rem; font-weight: 600;"></p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);"></p>
                    </div>
                    
                    <!-- Download Progress Section (hidden by default) -->
                    <div id="download-progress" style="display: none; margin-bottom: 16px;">
                        <div style="background: var(--bg-secondary); border-radius: 8px; overflow: hidden; height: 8px; margin-bottom: 8px;">
                            <div id="progress-bar" style="height: 100%; background: var(--accent-gradient); width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary);">
                            <span id="progress-percent">0%</span>
                            <span id="progress-speed">در حال اتصال...</span>
                        </div>
                        <p id="progress-status" style="text-align: center; margin-top: 8px; font-size: 0.85rem;"></p>
                    </div>
                    
                    <div id="download-buttons" style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="modal-webtorrent-btn" class="modal-action-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            ⚡ دانلود در مرورگر
                        </button>
                        <button id="modal-download-btn" class="modal-action-btn" style="background: var(--accent-gradient); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            📥 باز کردن در نرم‌افزار
                        </button>
                        <button id="modal-copy-btn" class="modal-action-btn" style="background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); padding: 14px; border-radius: 12px; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            📋 کپی لینک
                        </button>
                    </div>
                    <p style="margin-top: 16px; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
                        دانلود در مرورگر نیاز به نرم‌افزار ندارد
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDownloadModal();
        });
    }

    // Update modal content
    const infoDiv = modal.querySelector('#download-modal-info');
    infoDiv.innerHTML = `
        <p style="font-size: 1rem; font-weight: 600;">${quality || 'کیفیت نامشخص'}</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">منبع: ${source || 'نامشخص'}</p>
    `;

    // Reset progress section
    const progressSection = modal.querySelector('#download-progress');
    const buttonsSection = modal.querySelector('#download-buttons');
    progressSection.style.display = 'none';
    buttonsSection.style.display = 'flex';

    // Set up button actions
    const webTorrentBtn = modal.querySelector('#modal-webtorrent-btn');
    const downloadBtn = modal.querySelector('#modal-download-btn');
    const copyBtn = modal.querySelector('#modal-copy-btn');

    webTorrentBtn.onclick = () => startWebTorrentDownload(magnetLink);

    downloadBtn.onclick = () => {
        window.location.href = magnetLink;
        closeDownloadModal();
        showToast('🧲 در حال باز کردن در نرم‌افزار تورنت...');
    };

    copyBtn.onclick = () => copyMagnetLink(magnetLink);

    // Show modal
    modal.classList.remove('hidden');
}

// WebTorrent in-browser download
function startWebTorrentDownload(magnetLink) {
    const modal = document.getElementById('download-modal');
    const progressSection = modal.querySelector('#download-progress');
    const buttonsSection = modal.querySelector('#download-buttons');
    const progressBar = modal.querySelector('#progress-bar');
    const progressPercent = modal.querySelector('#progress-percent');
    const progressSpeed = modal.querySelector('#progress-speed');
    const progressStatus = modal.querySelector('#progress-status');

    // Check if WebTorrent is available
    if (typeof WebTorrent === 'undefined') {
        showToast('❌ WebTorrent در دسترس نیست');
        return;
    }

    // Show progress, hide buttons
    progressSection.style.display = 'block';
    buttonsSection.style.display = 'none';
    progressStatus.textContent = 'در حال اتصال به تورنت...';

    // Cancel previous download if any
    if (currentTorrent) {
        currentTorrent.destroy();
        currentTorrent = null;
    }

    // Create WebTorrent client if needed
    if (!webTorrentClient) {
        webTorrentClient = new WebTorrent();
    }

    // Start download
    currentTorrent = webTorrentClient.add(magnetLink, {
        announce: [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.btorrent.xyz',
            'wss://tracker.fastcast.nz'
        ]
    });

    currentTorrent.on('metadata', () => {
        progressStatus.textContent = `📦 ${currentTorrent.name}`;
    });

    currentTorrent.on('download', () => {
        const percent = (currentTorrent.progress * 100).toFixed(1);
        const speed = formatBytes(currentTorrent.downloadSpeed) + '/s';

        progressBar.style.width = percent + '%';
        progressPercent.textContent = percent + '%';
        progressSpeed.textContent = speed;
    });

    currentTorrent.on('done', () => {
        progressStatus.textContent = '✅ دانلود کامل شد!';
        progressPercent.textContent = '100%';
        progressSpeed.textContent = '';

        // Create download link for files
        currentTorrent.files.forEach(file => {
            file.getBlobURL((err, url) => {
                if (err) return console.error(err);

                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
            });
        });

        showToast('✅ دانلود کامل شد!');
    });

    currentTorrent.on('error', (err) => {
        console.error('Torrent error:', err);
        progressStatus.textContent = '❌ خطا در دانلود';
        showToast('❌ خطا در دانلود تورنت');

        // Show buttons again
        setTimeout(() => {
            progressSection.style.display = 'none';
            buttonsSection.style.display = 'flex';
        }, 2000);
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.classList.add('hidden');

        // Cancel current download when closing
        if (currentTorrent) {
            currentTorrent.destroy();
            currentTorrent = null;
        }
    }
}

function copyMagnetLink(magnetLink) {
    navigator.clipboard.writeText(magnetLink).then(() => {
        showToast('✅ لینک کپی شد!');
        closeDownloadModal();
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = magnetLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ لینک کپی شد!');
        closeDownloadModal();
    });
}

// ===================================
// Event Listeners
// ===================================

function setupEventListeners() {
    // Search
    elements.searchBtn.addEventListener('click', () => {
        searchMovies(elements.searchInput.value);
    });

    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchMovies(elements.searchInput.value);
        }
    });

    // Back buttons
    elements.backBtn.addEventListener('click', () => {
        showView('home');
    });

    elements.movieBackBtn.addEventListener('click', () => {
        if (state.searchResults.length > 0) {
            showView('results');
        } else {
            showView('home');
        }
    });

    // Help back button
    elements.helpBackBtn.addEventListener('click', () => {
        showView('home');
    });

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'search') {
                elements.searchInput.focus();
            } else {
                showView(view);
            }
        });
    });

    // Quick access buttons
    elements.quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            switch (action) {
                case 'trending':
                    showView('results');
                    elements.resultsTitle.textContent = '🔥 ترندینگ';
                    getTrendingResults();
                    break;
                case 'tv':
                    getTV();
                    break;
                case 'anime':
                    getAnime();
                    break;
                case 'genres':
                    getGenres();
                    break;
            }
        });
    });

    // Genres back button
    if (elements.genresBackBtn) {
        elements.genresBackBtn.addEventListener('click', () => {
            showView('home');
        });
    }

    // Telegram back button
    if (tg) {
        tg.BackButton.onClick(() => {
            if (state.currentView === 'movie') {
                if (state.searchResults.length > 0) {
                    showView('results');
                } else {
                    showView('home');
                }
            } else if (state.currentView === 'results') {
                showView('home');
            } else {
                tg.close();
            }
        });
    }
}

// ===================================
// Initialize App
// ===================================

async function init() {
    console.log('🎬 Movie Finder Mini App initializing...');

    // Init Telegram
    initTelegram();

    // Setup events
    setupEventListeners();

    // Load trending movies
    await getTrending();

    // Hide loading, show app
    elements.loadingScreen.classList.add('hidden');
    elements.app.classList.remove('hidden');

    // Show back button in Telegram for non-home views
    if (tg) {
        tg.BackButton.show();
    }

    console.log('✅ App ready!');
}

// ===================================
// Subtitle & Download Guide Functions
// ===================================

async function searchSubtitles(title, year) {
    showToast('🔍 در حال جستجوی زیرنویس...');

    try {
        const data = await apiRequest(`/ api / subtitles ? title = ${encodeURIComponent(title)}& year=${year} `);
        const subtitles = data.subtitles || [];

        if (subtitles.length === 0) {
            // Show fallback search link
            if (tg) {
                tg.openLink(data.searchUrl);
            } else {
                window.open(data.searchUrl, '_blank');
            }
            showToast('زیرنویس یافت نشد - به سایت منتقل شدید');
            return;
        }

        // Show subtitle modal
        const modalHTML = `
                < div class="modal-overlay" onclick = "closeModal(event)" >
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h3>📝 زیرنویس فارسی</h3>
                            <button class="modal-close" onclick="closeModal()">✕</button>
                        </div>
                        <div class="modal-body">
                            ${subtitles.map(sub => `
                            <a href="${sub.url}" class="subtitle-item" target="_blank">
                                <span class="subtitle-name">${sub.name.substring(0, 50)}</span>
                                <span class="subtitle-author">👤 ${sub.author}</span>
                            </a>
                        `).join('')}
                            <a href="${data.searchUrl}" class="subtitle-more" target="_blank">
                                🔍 جستجوی بیشتر در Subscene
                            </a>
                        </div>
                    </div>
            </div >
                `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        showToast('❌ خطا در جستجوی زیرنویس');
    }
}

function showDownloadGuide() {
    const modalHTML = `
                < div class="modal-overlay" onclick = "closeModal(event)" >
                    <div class="modal-content guide-modal" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h3>📥 راهنمای دانلود</h3>
                            <button class="modal-close" onclick="closeModal()">✕</button>
                        </div>
                        <div class="modal-body">
                            <div class="guide-section">
                                <h4>📱 بات تلگرام <span class="guide-badge telegram">Filmeh, CastroFilm</span></h4>
                                <ul>
                                    <li>روی لینک کلیک کنید</li>
                                    <li>به بات تلگرام منتقل می‌شوید</li>
                                    <li>دکمه Start را بزنید</li>
                                    <li>✅ فایل در تلگرام دریافت کنید</li>
                                </ul>
                            </div>
                            <div class="guide-section">
                                <h4>🧲 لینک مگنت <span class="guide-badge torrent">1337x, YTS</span></h4>
                                <ul>
                                    <li>برنامه تورنت نصب کنید (uTorrent یا qBittorrent)</li>
                                    <li>روی لینک مگنت کلیک کنید</li>
                                    <li>در برنامه تورنت باز می‌شود</li>
                                    <li>✅ دانلود شروع می‌شود</li>
                                </ul>
                            </div>
                            <div class="guide-section players">
                                <h4>📱 پخش‌کننده‌های پیشنهادی</h4>
                                <p><strong>موبایل:</strong> MX Player, VLC</p>
                                <p><strong>کامپیوتر:</strong> VLC, PotPlayer</p>
                            </div>
                        </div>
                    </div>
        </div >
                `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make functions available globally
window.handleTelegramLink = handleTelegramLink;
window.searchSubtitles = searchSubtitles;
window.showDownloadGuide = showDownloadGuide;
window.closeModal = closeModal;
