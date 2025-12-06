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
    navItems: document.querySelectorAll('.nav-item')
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
    }

    // Update nav
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
}

// ===================================
// API Functions
// ===================================

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(tg?.initData && { 'X-Telegram-Init-Data': tg.initData })
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('❌ خطا در برقراری ارتباط');
        throw error;
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
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            const movie = movies[index];
            if (movie) {
                state.selectedMovie = movie;
                renderMovieDetail(movie);
                showView('movie');
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

    // Download links
    const torrents = movie.torrents || [];
    if (torrents.length === 0) {
        elements.downloadLinks.innerHTML = `
            <div class="empty-state">
                <p>لینک دانلود موجود نیست</p>
                <p style="font-size: 0.8rem; margin-top: 8px;">از طریق بات جستجو کنید</p>
            </div>
        `;
    } else {
        elements.downloadLinks.innerHTML = torrents.map((torrent, i) => {
            const isDirectLink = torrent.isDirect || !torrent.magnetLink?.startsWith('magnet:');
            const isTelegramBot = torrent.isTelegramBot || torrent.magnetLink?.includes('t.me');

            return `
                <a href="${torrent.magnetLink}" 
                   class="download-btn" 
                   target="_blank"
                   ${isTelegramBot ? 'onclick="handleTelegramLink(event, this)"' : ''}>
                    <div class="download-info">
                        <span class="download-quality">${torrent.quality || 'نامشخص'}</span>
                        <span class="download-source">${torrent.source || 'نامشخص'}</span>
                    </div>
                    <span class="download-size">${torrent.size || ''}</span>
                </a>
            `;
        }).join('');
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

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make handleTelegramLink available globally
window.handleTelegramLink = handleTelegramLink;
