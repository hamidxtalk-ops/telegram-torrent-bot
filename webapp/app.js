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
    container.innerHTML = movies.map((movie, index) => `
        <div class="movie-card" data-movie-id="${movie.id || index}" data-index="${index}">
            <div class="movie-card-poster" style="background-image: url('${movie.poster || movie.posterLarge || getPlaceholderPoster()}')">
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
        elements.downloadLinks.innerHTML = actionsHTML + `
            <div class="empty-state">
                <p>لینک دانلود موجود نیست</p>
                <p style="font-size: 0.8rem; margin-top: 8px;">از طریق بات جستجو کنید</p>
            </div>
        `;
    } else {
        // Filter: Only Telegram and Torrent (magnet) links - no direct downloads
        const filteredTorrents = torrents.filter(torrent => {
            const isTelegramBot = torrent.isTelegramBot || (torrent.magnetLink && torrent.magnetLink.includes('t.me'));
            const isMagnet = torrent.magnetLink && torrent.magnetLink.startsWith('magnet:');

            // Allow Telegram and Magnet links only
            return isTelegramBot || isMagnet;
        });

        if (filteredTorrents.length === 0) {
            elements.downloadLinks.innerHTML = actionsHTML + `
                <div class="empty-state">
                    <p>لینک دانلود موجود نیست</p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">از طریق بات جستجو کنید</p>
                </div>
            `;
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

                return `
                    <a href="${torrent.magnetLink}" 
                       class="download-btn ${typeClass}"
                       target="_blank"
                       ${isTelegramBot ? 'onclick="handleTelegramLink(event, this)"' : ''}>
                        <div class="download-info">
                            <span class="download-type-badge">${typeBadge}</span>
                            <span class="download-quality">${torrent.quality || 'نامشخص'}</span>
                            <span class="download-source">${torrent.source || 'نامشخص'}</span>
                        </div>
                        <span class="download-size">${torrent.size || ''}</span>
                    </a>
                `;
            }).join('');

            elements.downloadLinks.innerHTML = actionsHTML + linksHTML;
        }
    }
}

function showLoadingSkeleton(container, count = 6) {
    container.innerHTML = Array(count).fill(`
        <div class="movie-card skeleton">
            <div class="movie-card-poster skeleton"></div>
            <div class="movie-card-info">
                <div class="skeleton" style="height: 16px; margin-bottom: 4px;"></div>
                <div class="skeleton" style="height: 12px; width: 50%;"></div>
            </div>
        </div>
    `).join('');
}

function showEmptyState(container, message) {
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🎬</div>
            <p>${message}</p>
        </div>
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
        <div class="genre-card" data-genre-id="${genre.id}" data-genre-name="${genre.name}">
            <span class="genre-icon">${genreIcons[genre.id] || '🎬'}</span>
            <span class="genre-name">${genre.name}</span>
        </div>
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
    const url = element.href;

    if (tg) {
        tg.openTelegramLink(url);
    } else {
        window.open(url, '_blank');
    }
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
        const data = await apiRequest(`/api/subtitles?title=${encodeURIComponent(title)}&year=${year}`);
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
            <div class="modal-overlay" onclick="closeModal(event)">
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
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        showToast('❌ خطا در جستجوی زیرنویس');
    }
}

function showDownloadGuide() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
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
        </div>
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
