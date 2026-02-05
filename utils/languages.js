/**
 * Multi-language Support
 * Strings for English, Persian (Farsi), and Spanish
 */

const languages = {
    en: {
        name: 'English',
        flag: '🇬🇧',

        // General
        welcome: `🎬 *Welcome to Torrent Movie Bot!*

I can help you find movie torrents from various sources.

*Commands:*
• /search <movie name> - Search for movies
• /trending - View trending movies
• /browse <genre> - Browse by genre
• /favorites - Your saved movies
• /history - Recent searches
• /help - Show all commands
• /language - Change language
• /legal - Legal disclaimer

Just send me a movie name to start searching!`,

        help: `📚 *Bot Commands*

*Search:*
• /search <name> - Search movies
• Just type any movie name directly

*Browse:*
• /trending - Trending movies
• /browse action - Browse by genre

*Personal:*
• /favorites - Saved movies
• /history - Search history

*Settings:*
• /language - Change language
• /legal - Legal info
• /help - This message

*Tips:*
• Use the buttons to select quality
• ⭐ Save movies to favorites
• 🔄 Get more sources

*Rate Limits:*
• 2 searches per minute
• 50 searches per day`,

        searching: '🔍 Searching...',
        noResults: '❌ No results found. Try a different search term.',
        rateLimitMinute: '⏳ Rate limit reached. Please wait {seconds} seconds.',
        rateLimitDaily: '📅 Daily limit reached ({max} searches). Try again tomorrow!',
        selectQuality: '🔗 Select a quality to get the magnet link:',
        magnetLink: '🧲 *Magnet Link*\n\nClick to copy or open in your torrent client:\n\n`{link}`',
        addedToFavorites: '⭐ Added to favorites!',
        removedFromFavorites: '❌ Removed from favorites.',
        alreadyFavorite: '⭐ Already in your favorites!',
        errorGeneral: '❌ Something went wrong. Please try again.',
        termsRequired: '⚠️ Please accept the terms first by typing /start',

        // Legal
        legal: `⚖️ *Legal Disclaimer*

This bot provides links to torrent files available on the internet. We do not host any content ourselves.

*Important:*
• Downloading copyrighted content may be illegal in your country
• You are solely responsible for the content you download
• This bot is for educational purposes only
• By using this bot, you accept full responsibility for your actions

*Recommendations:*
• Check your local laws before downloading
• Use a VPN for privacy
• Support creators by purchasing content legally`,

        acceptTerms: 'I Accept Terms',
        termsAccepted: '✅ Terms accepted. You can now use the bot!',

        // Browse
        trendingTitle: '🔥 Trending Movies',
        browseGenres: `🎭 *Browse by Genre*

Select a genre:`,
        genres: {
            action: '💥 Action',
            comedy: '😂 Comedy',
            drama: '🎭 Drama',
            horror: '👻 Horror',
            scifi: '🚀 Sci-Fi',
            romance: '💕 Romance',
            thriller: '😱 Thriller',
            animation: '🎨 Animation'
        }
    },

    fa: {
        name: 'فارسی',
        flag: '🇮🇷',

        welcome: `🎬 *به ربات تورنت فیلم خوش آمدید!*

من می‌توانم به شما در پیدا کردن تورنت فیلم‌ها کمک کنم.

*دستورات:*
• /search <نام فیلم> - جستجوی فیلم
• /trending - فیلم‌های پرطرفدار
• /browse <ژانر> - مرور بر اساس ژانر
• /favorites - فیلم‌های ذخیره شده
• /history - جستجوهای اخیر
• /help - نمایش دستورات
• /language - تغییر زبان
• /legal - اطلاعات حقوقی

برای شروع، نام یک فیلم را بفرستید!`,

        help: `📚 *دستورات ربات*

*جستجو:*
• /search <نام> - جستجوی فیلم
• یا مستقیماً نام فیلم را بنویسید

*مرور:*
• /trending - فیلم‌های پرطرفدار
• /browse action - مرور ژانر

*شخصی:*
• /favorites - فیلم‌های ذخیره شده
• /history - تاریخچه جستجو

*تنظیمات:*
• /language - تغییر زبان
• /legal - اطلاعات حقوقی
• /help - این پیام`,

        searching: '🔍 در حال جستجو...',
        noResults: '❌ نتیجه‌ای یافت نشد. عبارت دیگری را امتحان کنید.',
        rateLimitMinute: '⏳ محدودیت نرخ. لطفاً {seconds} ثانیه صبر کنید.',
        rateLimitDaily: '📅 محدودیت روزانه ({max} جستجو). فردا دوباره امتحان کنید!',
        selectQuality: '🔗 یک کیفیت برای دریافت لینک مگنت انتخاب کنید:',
        magnetLink: '🧲 *لینک مگنت*\n\nبرای کپی یا باز کردن در کلاینت تورنت کلیک کنید:\n\n`{link}`',
        addedToFavorites: '⭐ به علاقه‌مندی‌ها اضافه شد!',
        removedFromFavorites: '❌ از علاقه‌مندی‌ها حذف شد.',
        alreadyFavorite: '⭐ قبلاً در علاقه‌مندی‌ها موجود است!',
        errorGeneral: '❌ مشکلی پیش آمد. لطفاً دوباره امتحان کنید.',
        termsRequired: '⚠️ لطفاً ابتدا با تایپ /start قوانین را بپذیرید',

        legal: `⚖️ *سلب مسئولیت قانونی*

این ربات لینک فایل‌های تورنت موجود در اینترنت را ارائه می‌دهد.

*مهم:*
• دانلود محتوای دارای حق نسخه‌برداری ممکن است غیرقانونی باشد
• شما مسئول محتوایی هستید که دانلود می‌کنید
• این ربات فقط برای اهداف آموزشی است`,

        acceptTerms: 'قوانین را می‌پذیرم',
        termsAccepted: '✅ قوانین پذیرفته شد. اکنون می‌توانید از ربات استفاده کنید!',

        trendingTitle: '🔥 فیلم‌های پرطرفدار',
        browseGenres: `🎭 *مرور بر اساس ژانر*

یک ژانر انتخاب کنید:`,
        genres: {
            action: '💥 اکشن',
            comedy: '😂 کمدی',
            drama: '🎭 درام',
            horror: '👻 ترسناک',
            scifi: '🚀 علمی-تخیلی',
            romance: '💕 عاشقانه',
            thriller: '😱 هیجانی',
            animation: '🎨 انیمیشن'
        }
    },

    es: {
        name: 'Español',
        flag: '🇪🇸',

        welcome: `🎬 *¡Bienvenido al Bot de Películas Torrent!*

Puedo ayudarte a encontrar torrents de películas.

*Comandos:*
• /search <nombre> - Buscar películas
• /trending - Películas populares
• /browse <género> - Explorar por género
• /favorites - Películas guardadas
• /history - Búsquedas recientes
• /help - Mostrar comandos
• /language - Cambiar idioma
• /legal - Aviso legal

¡Envíame el nombre de una película para empezar!`,

        help: `📚 *Comandos del Bot*

*Buscar:*
• /search <nombre> - Buscar películas
• O escribe directamente el nombre

*Explorar:*
• /trending - Películas populares
• /browse action - Explorar género

*Personal:*
• /favorites - Películas guardadas
• /history - Historial de búsqueda

*Configuración:*
• /language - Cambiar idioma
• /legal - Info legal
• /help - Este mensaje`,

        searching: '🔍 Buscando...',
        noResults: '❌ No se encontraron resultados. Intenta con otro término.',
        rateLimitMinute: '⏳ Límite alcanzado. Espera {seconds} segundos.',
        rateLimitDaily: '📅 Límite diario alcanzado ({max} búsquedas). ¡Intenta mañana!',
        selectQuality: '🔗 Selecciona una calidad para obtener el enlace magnet:',
        magnetLink: '🧲 *Enlace Magnet*\n\nClic para copiar o abrir en tu cliente torrent:\n\n`{link}`',
        addedToFavorites: '⭐ ¡Añadido a favoritos!',
        removedFromFavorites: '❌ Eliminado de favoritos.',
        alreadyFavorite: '⭐ ¡Ya está en favoritos!',
        errorGeneral: '❌ Algo salió mal. Por favor, inténtalo de nuevo.',
        termsRequired: '⚠️ Por favor acepta los términos escribiendo /start',

        legal: `⚖️ *Aviso Legal*

Este bot proporciona enlaces a archivos torrent disponibles en internet.

*Importante:*
• Descargar contenido con derechos de autor puede ser ilegal
• Eres responsable del contenido que descargas
• Este bot es solo para fines educativos`,

        acceptTerms: 'Acepto los Términos',
        termsAccepted: '✅ ¡Términos aceptados! Ya puedes usar el bot.',

        trendingTitle: '🔥 Películas Populares',
        browseGenres: `🎭 *Explorar por Género*

Selecciona un género:`,
        genres: {
            action: '💥 Acción',
            comedy: '😂 Comedia',
            drama: '🎭 Drama',
            horror: '👻 Terror',
            scifi: '🚀 Ciencia Ficción',
            romance: '💕 Romance',
            thriller: '😱 Suspenso',
            animation: '🎨 Animación'
        }
    }
};

/**
 * Get translated string
 * @param {string} lang - Language code (en, fa, es)
 * @param {string} key - Translation key
 * @param {Object} params - Parameters to replace in string
 * @returns {string} Translated string
 */
export function t(lang, key, params = {}) {
    const langData = languages[lang] || languages.en;
    let text = langData[key] || languages.en[key] || key;

    // Handle nested keys (e.g., 'genres.action')
    if (key.includes('.')) {
        const keys = key.split('.');
        text = keys.reduce((obj, k) => obj?.[k], langData) ||
            keys.reduce((obj, k) => obj?.[k], languages.en) ||
            key;
    }

    // Replace parameters
    Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
    });

    return text;
}

/**
 * Get available languages
 * @returns {Array} Array of language options
 */
export function getLanguageOptions() {
    return Object.entries(languages).map(([code, data]) => ({
        code,
        name: data.name,
        flag: data.flag
    }));
}

/**
 * Format language selection keyboard
 * @returns {Array} Inline keyboard
 */
export function getLanguageKeyboard() {
    return Object.entries(languages).map(([code, data]) => [{
        text: `${data.flag} ${data.name}`,
        callback_data: `lang:${code}`
    }]);
}

export default { t, getLanguageOptions, getLanguageKeyboard, languages };
