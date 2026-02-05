/**
 * Movie Finder - Standalone Website
 * API calls to Render backend
 */

// API Base URL (Render backend)
const API_BASE = 'https://telegram-torrent-bot-hiy7.onrender.com';

// State
const state = {
    currentSection: 'home',
    moviesCache: {} // Store movies by grid for click handling
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    setupEventListeners();
    loadTrending();
    loadGenres();
}

// Event Listeners
function setupEventListeners() {
    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            handleNavClick(section);
        });
    });

    // Hero search
    document.getElementById('main-search-btn').addEventListener('click', () => {
        const query = document.getElementById('main-search-input').value;
        if (query.trim()) search(query);
    });

    document.getElementById('main-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value;
            if (query.trim()) search(query);
        }
    });

    // Header search
    document.getElementById('header-search-btn').addEventListener('click', () => {
        const query = document.getElementById('header-search-input').value;
        if (query.trim()) search(query);
    });

    document.getElementById('header-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value;
            if (query.trim()) search(query);
        }
    });

    // Back button
    document.getElementById('back-to-home').addEventListener('click', () => {
        showSection('home');
    });
}

// Navigation
function handleNavClick(section) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

    if (section === 'home') {
        showSection('home');
    } else if (section === 'trending') {
        showSection('home');
        document.getElementById('trending-section').scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'genres') {
        showSection('genres');
    } else if (section === 'tv') {
        showSection('tv');
        loadTV();
    } else if (section === 'anime') {
        showSection('anime');
        loadAnime();
    }
}

function showSection(section) {
    state.currentSection = section;

    // Hide all sections
    document.getElementById('hero-section').style.display = section === 'home' ? 'block' : 'none';
    document.getElementById('trending-section').classList.toggle('hidden', section !== 'home');
    document.getElementById('results-section').classList.toggle('hidden', section !== 'results');
    document.getElementById('genres-section').classList.toggle('hidden', section !== 'genres');
    document.getElementById('tv-section').classList.toggle('hidden', section !== 'tv');
    document.getElementById('anime-section').classList.toggle('hidden', section !== 'anime');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// API Calls
async function apiRequest(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('❌ خطا در ارتباط با سرور');
        return { results: [] };
    }
}

// Search
async function search(query) {
    showLoading(true);
    showSection('results');
    document.getElementById('results-title').textContent = `نتایج جستجو: ${query}`;
    document.getElementById('results-grid').innerHTML = '';

    const data = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`);
    showLoading(false);

    if (data.results?.length > 0) {
        renderMovies(data.results, 'results-grid');
    } else {
        document.getElementById('results-grid').innerHTML = '<div class="empty-state">نتیجه‌ای یافت نشد</div>';
    }
}

// Load Trending
async function loadTrending() {
    const grid = document.getElementById('trending-grid');
    grid.innerHTML = '<div class="empty-state">در حال بارگذاری...</div>';

    const data = await apiRequest('/api/trending');

    if (data.results?.length > 0) {
        renderMovies(data.results, 'trending-grid');
    } else {
        grid.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>';
    }
}

// Load Genres
async function loadGenres() {
    const grid = document.getElementById('genres-grid');
    const data = await apiRequest('/api/genres');

    if (data.genres?.length > 0) {
        grid.innerHTML = data.genres.map(genre => `
            <div class="genre-card" onclick="loadGenreMovies(${genre.id}, '${genre.name}')">
                <span class="genre-icon">${genre.icon || '🎬'}</span>
                <span class="genre-name">${genre.name}</span>
            </div>
        `).join('');
    }
}

// Load Genre Movies
async function loadGenreMovies(genreId, genreName) {
    showSection('results');
    document.getElementById('results-title').textContent = `ژانر: ${genreName}`;
    document.getElementById('results-grid').innerHTML = '<div class="empty-state">در حال بارگذاری...</div>';

    const data = await apiRequest(`/api/genre/${genreId}`);

    if (data.results?.length > 0) {
        renderMovies(data.results, 'results-grid');
    } else {
        document.getElementById('results-grid').innerHTML = '<div class="empty-state">نتیجه‌ای یافت نشد</div>';
    }
}

// Load TV
async function loadTV() {
    const grid = document.getElementById('tv-grid');
    grid.innerHTML = '<div class="empty-state">در حال بارگذاری...</div>';

    const data = await apiRequest('/api/tv');

    if (data.results?.length > 0) {
        renderMovies(data.results, 'tv-grid');
    } else {
        grid.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>';
    }
}

// Load Anime
async function loadAnime() {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '<div class="empty-state">در حال بارگذاری...</div>';

    const data = await apiRequest('/api/anime');

    if (data.results?.length > 0) {
        renderMovies(data.results, 'anime-grid');
    } else {
        grid.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>';
    }
}

// Render Movies
function renderMovies(movies, gridId) {
    // Store movies in cache for click handling
    state.moviesCache[gridId] = movies;

    const grid = document.getElementById(gridId);
    grid.innerHTML = movies.map((movie, index) => `
        <div class="movie-card" data-grid="${gridId}" data-index="${index}" onclick="handleMovieClick(this)">
            <div class="movie-poster">
                ${movie.poster ?
            `<img src="${movie.poster}" alt="${escapeHtml(movie.title)}" loading="lazy">` :
            '<div style="height:100%;display:flex;align-items:center;justify-content:center;">🎬</div>'
        }
                ${movie.rating ? `<span class="movie-rating">⭐ ${movie.rating}</span>` : ''}
            </div>
            <div class="movie-info">
                <div class="movie-title">${escapeHtml(movie.title)}</div>
                <div class="movie-year">${movie.year || ''}</div>
            </div>
        </div>
    `).join('');
}

// Handle movie card click
function handleMovieClick(card) {
    const gridId = card.dataset.grid;
    const index = parseInt(card.dataset.index);
    const movie = state.moviesCache[gridId]?.[index];
    if (movie) {
        showMovieDetail(movie);
    }
}

// Show Movie Detail
async function showMovieDetail(movie) {
    const modal = document.getElementById('movie-modal');
    const modalBody = document.getElementById('modal-body');

    // Show modal with loading
    modal.classList.remove('hidden');
    modalBody.innerHTML = '<div class="loading"><div class="spinner"></div><p>در حال دریافت اطلاعات...</p></div>';

    // Fetch full details if we have an ID
    let fullDetails = movie;
    if (movie.id && !movie.torrents?.length) {
        try {
            const data = await apiRequest(`/api/movie/${movie.id}`);
            if (data && !data.error) {
                fullDetails = { ...movie, ...data };
            }
        } catch (e) {
            console.log('Could not fetch details');
        }
    }

    // Render modal content
    const poster = fullDetails.posterLarge || fullDetails.poster;
    const torrents = fullDetails.torrents || [];

    modalBody.innerHTML = `
        <div class="modal-movie">
            <div class="modal-poster">
                ${poster ? `<img src="${poster}" alt="${escapeHtml(fullDetails.title)}">` : '<div style="height:300px;background:#1a1a2a;display:flex;align-items:center;justify-content:center;">🎬</div>'}
            </div>
            <div class="modal-details">
                <h2>${escapeHtml(fullDetails.title)}</h2>
                <div class="modal-meta">
                    ${fullDetails.year ? `<span>📅 ${fullDetails.year}</span>` : ''}
                    ${fullDetails.rating ? `<span class="rating">⭐ ${fullDetails.rating}</span>` : ''}
                    ${fullDetails.runtime ? `<span>⏱ ${fullDetails.runtime} دقیقه</span>` : ''}
                </div>
                ${fullDetails.synopsis || fullDetails.overview ? `<p class="modal-synopsis">${escapeHtml(fullDetails.synopsis || fullDetails.overview)}</p>` : ''}
                
                ${fullDetails.genres?.length ? `
                    <div class="modal-genres">
                        ${fullDetails.genres.map(g => `<span class="modal-genre-tag">${g.name || g}</span>`).join('')}
                    </div>
                ` : ''}

                <div class="download-section">
                    <h3>📥 لینک‌های دانلود</h3>
                    <div class="download-list">
                        ${torrents.length > 0 ? torrents.map((t, i) => `
                            <div class="download-item">
                                <div class="download-info">
                                    <span class="download-quality">${escapeHtml(t.quality || t.title || 'دانلود')}</span>
                                    <span class="download-source">${escapeHtml(t.source || 'Unknown')} ${t.size ? `- ${t.size}` : ''}</span>
                                </div>
                                <button class="download-btn" data-link="${encodeURIComponent(t.magnetLink || t.url || t.link || '')}" onclick="handleDownloadClick(this)">
                                    دانلود
                                </button>
                            </div>
                        `).join('') : '<div class="empty-state">لینک دانلود یافت نشد</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Handle Download Click from button
function handleDownloadClick(button) {
    const encodedLink = button.dataset.link;
    if (!encodedLink) {
        showToast('❌ لینک نامعتبر');
        return;
    }
    const link = decodeURIComponent(encodedLink);
    handleDownload(link);
}

// Handle Download
function handleDownload(link) {
    if (!link) {
        showToast('❌ لینک نامعتبر');
        return;
    }

    if (link.includes('t.me')) {
        window.open(link, '_blank');
        showToast('📱 در حال انتقال به تلگرام...');
    } else if (link.startsWith('magnet:')) {
        // Open Webtor.io for magnet links
        const webtorUrl = `https://webtor.io/#/show?magnet=${encodeURIComponent(link)}`;
        window.open(webtorUrl, '_blank');
        showToast('🌐 در حال انتقال به Webtor.io...');
    } else if (link.startsWith('http')) {
        window.open(link, '_blank');
        showToast('📥 دانلود شروع شد');
    } else {
        showToast('⚠️ لینک پشتیبانی نمی‌شود');
    }
}

// Close Modal
function closeModal() {
    document.getElementById('movie-modal').classList.add('hidden');
}

// Loading
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
