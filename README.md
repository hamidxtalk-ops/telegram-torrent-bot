# Telegram Torrent Movie Bot

A Telegram bot for searching movie torrents.

## Deploy to Render.com (Free)

1. Fork/Push this code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Create "New Web Service"
4. Connect your GitHub repo
5. Set environment variables:
   - `BOT_TOKEN` = your Telegram bot token
   - `TMDB_API_KEY` = your TMDb API key
6. Deploy!

## Environment Variables

- `BOT_TOKEN` - Telegram Bot API token (required)
- `TMDB_API_KEY` - TMDb API key (required)

## Commands

- `/start` - Start the bot
- `/search movie name` - Search for movies
- `/trending` - Trending movies
- `/browse` - Browse by genre
- `/favorites` - Your saved movies
- `/history` - Search history
- `/help` - Help
