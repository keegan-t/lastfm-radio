/*
BUGS/CHANGES:
- Artist filter
*/

// Credentials - set via the Settings panel in the UI, stored in localStorage
const LASTFM_API_KEY = localStorage.getItem("lastfm_api_key") || "";
const SECRET = localStorage.getItem("lastfm_secret") || "";
const SESSION_KEY = localStorage.getItem("session_key");
const YOUTUBE_API_KEY = localStorage.getItem("youtube_api_key") || "";

// Elements
let tag = document.createElement('script');
let options = document.getElementById("options");
let playButton = document.getElementById("play-button");
let authButton = document.getElementById("auth-button");
let skipButton = document.getElementById("skip-button");
let prevButton = document.getElementById("prev-button");
let scrobbleButton = document.getElementById("scrobble-button");
let loopButton = document.getElementById("loop-button");
let songTitle = document.getElementById("song-title");
let player;

// Variables
let songList = [];
let cachedSongs = {};
let lovedTracks = new Set();
let currentSongIndex = 0;
let currentVideoID;
let loopToggled = false;

// Functions
function resetLoopButtonStyle() {
    loopButton.style.backgroundColor = "#444";
    loopButton.style.borderColor = "#444";
    loopButton.style.fontWeight = "";
}

/**
 * Retrieves a list of songs from the Last.FM API based on a minimum number of plays
 * The list order is then randomized
 *
 * @returns A randomized list of songs from the users library
 */
async function getSongList(user, minPlays, maxPlays, timePeriod, order) {
    switch (timePeriod) {
        case "Last 7 Days":
            timePeriod = "7day";
            break;
        case "Last Month":
            timePeriod = "1month";
            break;
        case "Last 3 Months":
            timePeriod = "3month";
            break;
        case "Last 6 Months":
            timePeriod = "6month";
            break;
        case "Last Year":
            timePeriod = "12month";
            break;
        default:
            timePeriod = "overall";
            break;
    }

    playButton.innerHTML = "Downloading..."

    // Initial request
    let URL = "https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=" + user + "&api_key=" + LASTFM_API_KEY + "&format=json&limit=1000&period=" + timePeriod + "&page=1";
    let response = await fetch(URL);
    let data = await response.json();

    if (data["error"]) {
        throw new Error("Last.FM error: " + data["message"]);
    }

    let pages = data["toptracks"]["@attr"]["totalPages"];
    let totalSongs = data["toptracks"]["@attr"]["total"];

    let minPlaysReached = false;

    for (let page = 1; page <= pages; page++) {
        if (page != 1) {
            URL = "https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=" + user + "&api_key=" + LASTFM_API_KEY + "&format=json&limit=1000&period=" + timePeriod + "&page=" + page;
            response = await fetch(URL);
            data = await response.json();
        }

        let songCount = Object.keys(data["toptracks"]["track"]).length;

        for (let i = 0; i < songCount; i++) {
            let track = data["toptracks"]["track"][i];
            let playcount = track["playcount"];
            if (playcount < minPlays) {
                minPlaysReached = true;
                break;
            }
            if (playcount <= maxPlays) {
                songList.push({
                    artist: track["artist"]["name"],
                    song: track["name"],
                    plays: playcount,
                    rank: track["@attr"]["rank"]
                })
            }
        }

        if (minPlaysReached) {
            break;
        }
    }

    if (songList.length == 0) {
        throw new Error("No songs found for the given criteria.");
    }

    if (order == "Random")
        songList.sort((x, y) => 0.5 - Math.random());
}

/**
 * Scrobbles the track that was just played
 */
function scrobblePreviousTrack() {
    let previousSongIndex = currentSongIndex - 1;
    if (previousSongIndex == -1) // Reached the end of the song list
        previousSongIndex = songList.length - 1;

    let artist = songList[previousSongIndex]["artist"];
    let song = songList[previousSongIndex]["song"];
    let timestamp = ~~(Date.now() / 1000);
    let apiSignature = "api_key" + LASTFM_API_KEY + "artist" + artist + "methodtrack.scrobble" + "sk" + SESSION_KEY + "timestamp" + timestamp + "track" + song + SECRET;
    apiSignature = md5(apiSignature);
    let encodedArtist = encodeURIComponent(artist);
    let encodedSong = encodeURIComponent(song);

    let url = "https://ws.audioscrobbler.com/2.0/" +
        "?api_key=" + LASTFM_API_KEY +
        "&api_sig=" + apiSignature +
        "&artist=" + encodedArtist +
        "&method=track.scrobble" +
        "&sk=" + SESSION_KEY +
        "&timestamp=" + timestamp +
        "&track=" + encodedSong +
        "&format=json";

    fetch(url, {
        method: "POST",
    })
        .then(response => response.json())
        .then(function (data) {
            if (data["error"] != null) {
                alert("API ERROR:\n" + data["message"]);
            }
        });
}

/**
 * Updates the "Scrobbling now" with the current track details
 */
function updateNowPlaying() {
    let loopOffset = loopToggled ? 1 : 0;
    let artist = songList[currentSongIndex - loopOffset]["artist"];
    let song = songList[currentSongIndex - loopOffset]["song"];
    let apiSignature = "api_key" + LASTFM_API_KEY + "artist" + artist + "methodtrack.updateNowPlaying" + "sk" + SESSION_KEY + "track" + song + SECRET;
    apiSignature = md5(apiSignature);
    let encodedArtist = encodeURIComponent(artist);
    let encodedSong = encodeURIComponent(song);

    let url = "https://ws.audioscrobbler.com/2.0/" +
        "?api_key=" + LASTFM_API_KEY +
        "&api_sig=" + apiSignature +
        "&artist=" + encodedArtist +
        "&method=track.updateNowPlaying" +
        "&sk=" + SESSION_KEY +
        "&track=" + encodedSong +
        "&format=json";

    fetch(url, {
        method: "POST",
    })
        .then(response => response.json())
        .then(function (data) {
            if (data["error"] != null) {
                alert("API ERROR:\n" + data["message"]);
            }
        });
}

/**
 * Queries the YouTube API for a given search
 *
 * @param {String} query The search query
 * @returns The video ID of the first result found from the query
 */
async function searchSong(query) {
    if (cachedSongs[query] !== undefined) {
        return cachedSongs[query];
    } else {
        query = query.replace("&", "%26")
        let queryURL = "https://www.googleapis.com/youtube/v3/search?key=" + YOUTUBE_API_KEY + "&type=video&maxResults=1&q=" + query;
        let response = await fetch(queryURL);
        let data = await response.json();

        if (data["error"]) {
            throw new Error("YouTube API error: " + data["error"]["message"]);
        }
        if (!data["items"] || data["items"].length === 0) {
            throw new Error("No YouTube results found for: " + query);
        }

        let ID = data["items"][0]["id"]["videoId"];

        return ID;
    }
}

/**
 * Sets the current video ID, updates now playing, and scrobbles the track if the previous video ended
 * Replays the current song if the loop is toggled
 */
async function getNextSong() {
    if (loopToggled) {
        scrobblePreviousTrack();
        updateNowPlaying();
        player.loadVideoById(currentVideoID);
        return;
    }
    let currentTrack = songList[currentSongIndex];
    let track = currentTrack["artist"] + " - " + currentTrack["song"];
    let loved = lovedTracks.has(track.toLowerCase());
    let heartPrefix = loved ? `<span style="color:crimson">♥</span> ` : "";
    songTitle.innerHTML = `#${parseInt(currentTrack["rank"]).toLocaleString()} | ${heartPrefix}${track} (${parseInt(currentTrack["plays"]).toLocaleString()} plays)`;
    document.title = `${loved ? "♥ " : ""}${track} (${parseInt(currentTrack["plays"]).toLocaleString()} plays)`;
    document.getElementById("player-wrapper").classList.toggle("loved-glow", loved);
    currentVideoID = await searchSong(track);
    updateNowPlaying();
    currentSongIndex++;
    // Looping back to start
    if (currentSongIndex == songList.length)
        currentSongIndex = 0;
}

/**
 * Generates the YouTube iFrame
 */
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: currentVideoID,
        playerVars: {
            'playsinline': 1,
            'rel': 0,
            'ecver': 0,
            'color': 'white'
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

/**
 * Plays the first video on ready
 *
 * @param {Event} event
 */
function onPlayerReady(event) {
    event.target.playVideo();
}

/**
 * Loads the next video when current video has ended
 *
 * @param {Event} event
 */
async function onPlayerStateChange(event) {
    if (event.data === 0) {
        // Only caching scrobbled songs
        let currentTrack = songList[currentSongIndex - 1];
        let track = currentTrack["artist"] + " - " + currentTrack["song"];
        cacheSong(track, currentVideoID);

        scrobblePreviousTrack();
        await getNextSong();
        player.loadVideoById(currentVideoID);
    }
}

/**
 * Saves a song->videoID mapping to the local cache in localStorage
 */
function cacheSong(track, videoID) {
    let localCache = JSON.parse(localStorage.getItem("song_cache") || "{}");
    localCache[track] = videoID;
    localStorage.setItem("song_cache", JSON.stringify(localCache));
    cachedSongs[track] = videoID;
}

/**
 * Gets the cached video IDs: merges the bundled cached_songs.json with any
 * locally cached entries stored in localStorage
 */
async function getCachedSongs() {
    let bundled = {};
    try {
        let response = await fetch("cached_songs.json");
        bundled = await response.json();
    } catch (e) {
    }
    let local = JSON.parse(localStorage.getItem("song_cache") || "{}");
    return Object.assign({}, bundled, local);
}

/**
 * Fetches all tracks the user has loved and populates the lovedTracks Set
 */
async function fetchLovedTracks(user) {
    lovedTracks.clear();
    let page = 1;
    while (true) {
        let url = "https://ws.audioscrobbler.com/2.0/?method=user.getlovedtracks&user=" + user + "&api_key=" + LASTFM_API_KEY + "&format=json&limit=1000&page=" + page;
        let response = await fetch(url);
        let data = await response.json();
        if (data["error"] || !data["lovedtracks"]) break;
        let tracks = data["lovedtracks"]["track"];
        if (!tracks || tracks.length === 0) break;
        for (let t of tracks) {
            lovedTracks.add((t["artist"]["name"] + " - " + t["name"]).toLowerCase());
        }
        let totalPages = parseInt(data["lovedtracks"]["@attr"]["totalPages"]);
        if (page >= totalPages) break;
        page++;
    }
}

// Event listeners

/**
 * Event listener for the "Play Your Library" button
 * Initializes the player and starts music playback
 */
playButton.addEventListener("click", async function () {
    // Getting form inputs
    let user = document.getElementById("username").value.trim();
    let minPlays = parseInt(document.getElementById("min-plays").value);
    let maxPlays = parseInt(document.getElementById("max-plays").value);
    let timePeriod = document.getElementById("period").value;
    let songOrder = document.getElementById("order").value;

    // Upfront validation
    if (!LASTFM_API_KEY || !SECRET) {
        alert("Last.FM API key and secret are required.\nClick Settings to configure them.");
        return;
    }
    if (!YOUTUBE_API_KEY) {
        alert("YouTube API key is required.\nClick Settings to configure it.");
        return;
    }
    if (!user) {
        alert("Please enter a Last.FM username.");
        return;
    }

    try {
        [cachedSongs] = await Promise.all([getCachedSongs(), fetchLovedTracks(user)]);
        await getSongList(user, minPlays, maxPlays, timePeriod, songOrder);
        await getNextSong();
    } catch (e) {
        alert("Error: " + e.message);
        playButton.innerHTML = "Play Library";
        songList = [];
        return;
    }

    // Load iFrame
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    document.getElementById("content").style.display = "block";
    document.getElementById("player-wrapper").style.display = "flex";
    document.getElementById("form-container").style.display = "none";
    document.getElementById("seeking").style.display = "block";
    let overlay = document.querySelector("#movie_player > div.ytp-pause-overlay-container > div");
    if (overlay) overlay.style.display = "none"; // Hide YouTube pause overlay
});

/**
 * Event listener for the Skip button
 * Skips the current song
 */
skipButton.addEventListener("click", async function () {
    loopToggled = false;
    await getNextSong();
    player.loadVideoById(currentVideoID);
});

/**
 * Event listener for the Scrobble button
 * Scrobbles and then skips the current song
 */
scrobbleButton.addEventListener("click", async function () {
    loopToggled = false;
    let currentTrack = songList[currentSongIndex - 1];
    let track = currentTrack["artist"] + " - " + currentTrack["song"];
    cacheSong(track, currentVideoID);
    scrobblePreviousTrack();
    await getNextSong();
    player.loadVideoById(currentVideoID);
});

/**
 * Event listener for the Previous button
 * Returns to previous song
 */
prevButton.addEventListener("click", async function () {
    if (currentSongIndex == 1)
        return;
    currentSongIndex -= 2;
    await getNextSong();
    player.loadVideoById(currentVideoID);
});

/**
 * Event listener for the Loop button
 * Loops the current track
 */
loopButton.addEventListener("click", async function () {
    loopToggled = !loopToggled;
    if (!loopToggled) {
        resetLoopButtonStyle();
    } else {
        loopButton.style.backgroundColor = "#198754";
        loopButton.style.borderColor = "#198754";
        loopButton.style.fontWeight = "bold";
    }
})

/**
 * Event listener for the Authenticate button
 * Retrieves the user's token
 */
authButton.addEventListener("click", function () {
    let key = localStorage.getItem("lastfm_api_key") || "";
    if (!key) {
        alert("Please configure your Last.FM API key in Settings first.");
        return;
    }
    let url = "https://www.last.fm/api/auth/?api_key=" + key + "&cb=" + window.location.href;
    location.replace(url)
})

/**
 * Event listener for the Settings save button
 * Persists API keys to localStorage and reloads the page
 */
document.getElementById("save-settings-button").addEventListener("click", function () {
    let lfmKey = document.getElementById("setting-lastfm-key").value.trim();
    let lfmSecret = document.getElementById("setting-lastfm-secret").value.trim();
    let ytKey = document.getElementById("setting-youtube-key").value.trim();
    if (lfmKey) localStorage.setItem("lastfm_api_key", lfmKey);
    if (lfmSecret) localStorage.setItem("lastfm_secret", lfmSecret);
    if (ytKey) localStorage.setItem("youtube_api_key", ytKey);
    location.reload();
})

// On load: populate settings fields with saved values and show setup notice if keys are missing
document.getElementById("setting-lastfm-key").value = localStorage.getItem("lastfm_api_key") || "";
document.getElementById("setting-lastfm-secret").value = localStorage.getItem("lastfm_secret") || "";
document.getElementById("setting-youtube-key").value = localStorage.getItem("youtube_api_key") || "";

if (!localStorage.getItem("lastfm_api_key") || !localStorage.getItem("lastfm_secret") || !localStorage.getItem("youtube_api_key")) {
    document.getElementById("setup-notice").style.display = "block";
}

// Persist and restore form fields across reloads
const formFields = [
    {id: "username", key: "form_username"},
    {id: "min-plays", key: "form_min_plays"},
    {id: "max-plays", key: "form_max_plays"},
    {id: "period", key: "form_period"},
    {id: "order", key: "form_order"},
];

formFields.forEach(({id, key}) => {
    let el = document.getElementById(id);
    let saved = localStorage.getItem(key);
    if (saved !== null) el.value = saved;
    el.addEventListener("change", () => localStorage.setItem(key, el.value));
});

// --- Inline video ID editor ---

/**
 * Extracts a YouTube video ID from a full URL or returns the input as-is
 */
function parseVideoId(input) {
    input = input.trim();
    try {
        let url = new URL(input);
        if (url.hostname === "youtu.be") return url.pathname.slice(1);
        return url.searchParams.get("v") || input;
    } catch {
        return input;
    }
}

document.getElementById("edit-video-button").addEventListener("click", function () {
    let row = document.getElementById("edit-video-row");
    let isVisible = row.style.display !== "none";
    if (isVisible) {
        row.style.display = "none";
    } else {
        document.getElementById("edit-video-input").value = currentVideoID || "";
        row.style.display = "flex";
        document.getElementById("edit-video-input").focus();
    }
});

document.getElementById("edit-video-confirm").addEventListener("click", function () {
    let input = document.getElementById("edit-video-input").value;
    let newId = parseVideoId(input);
    if (!newId) return;
    let currentTrack = songList[currentSongIndex - 1];
    let track = currentTrack["artist"] + " - " + currentTrack["song"];
    cacheSong(track, newId);
    currentVideoID = newId;
    player.loadVideoById(newId);
    document.getElementById("edit-video-row").style.display = "none";
});

document.getElementById("edit-video-cancel").addEventListener("click", function () {
    document.getElementById("edit-video-row").style.display = "none";
});

document.getElementById("edit-video-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("edit-video-confirm").click();
    if (e.key === "Escape") document.getElementById("edit-video-cancel").click();
});

// --- Cache import / export ---

document.getElementById("export-cache-button").addEventListener("click", async function () {
    let exported = await getCachedSongs();
    let blob = new Blob([JSON.stringify(exported, null, 2)], {type: "application/json"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cached_songs.json";
    a.click();
});

document.getElementById("import-cache-button").addEventListener("click", function () {
    document.getElementById("import-cache-input").click();
});

document.getElementById("import-cache-input").addEventListener("change", function (e) {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function (ev) {
        try {
            let imported = JSON.parse(ev.target.result);
            let existing = JSON.parse(localStorage.getItem("song_cache") || "{}");
            let merged = Object.assign({}, existing, imported);
            localStorage.setItem("song_cache", JSON.stringify(merged));
            Object.assign(cachedSongs, imported);
            alert("Imported " + Object.keys(imported).length + " entries.");
        } catch {
            alert("Failed to parse JSON file.");
        }
    };
    reader.readAsText(file);
    e.target.value = "";
});