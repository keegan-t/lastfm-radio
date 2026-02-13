# <img src="logo.png" height="40" align="center"> Last.FM Random Music Generator

A web app that builds a playlist from your Last.FM listening history and plays it through YouTube. Supports scrobbling back to Last.FM as you listen.

**[Try it on GitHub Pages →](https://keegan-t.github.io/lastfm-randomizer)**

## Features

- Pulls your top tracks from Last.FM filtered by play count and time period
- Plays them through an embedded YouTube player
- Scrobbles tracks back to Last.FM and updates your "Now Playing" status
- Caches YouTube video ID lookups in your browser so repeat searches are instant
- Controls: edit, previous, scrobble & next, skip, loop

## Setup

You need two API keys to use this app:

### 1. Last.FM API Key + Secret

1. Go to [https://www.last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Fill in the form
3. Copy your **API key** and **Shared secret**

### 2. YouTube Data API v3 Key

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/) and create a project
2. Enable the **YouTube Data API v3** under "APIs & Services"
3. Create an API key under "Credentials"

### Entering your keys

Open the app and click **Settings** in the top-right corner. Paste your three keys and click Save. They're stored in your browser's `localStorage`.

After saving, click **Authenticate** to link your Last.FM account (required for scrobbling). You'll be redirected to Last.FM and back.

## Usage

1. Enter your Last.FM username
2. Set minimum/maximum play count filters (narrows down which tracks are included)
3. Pick a time period
4. Choose Random or In Order
5. Click **Play Library**

- The app fetches your top tracks, shuffles them (if random), and starts playing. Tracks are scrobbled automatically when a song finishes, or manually with the [♪] button.
- YouTube video matching always takes the first search result. If a video is incorrect, you can edit it with the [✏] button.
- You can import or export a list of cached songs at any time.
