# resolver — self-hosted Instagram reel resolver (yt-dlp)

The Convex backend is JavaScript-only, but the most reliable Instagram
downloader is Python's `yt-dlp` (the same engine behind popular downloader
bots). This folder is a tiny self-hosted worker that turns an Instagram reel
link into a direct video URL — it is what `COMFY_REEL_RESOLVER` points at:

```
COMFY_REEL_RESOLVER = "https://your-resolver.example.com/resolve?url={url}"
```

## Setup (on your own VPS — home/regular IPs work best)

```bash
cd resolver
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000   # put nginx/TLS in front
```

## Endpoint

`GET /resolve?url=<instagram-reel-url>` →

```json
{ "video_url": "https://…/….mp4", "title": "…" }
```

The provider then downloads that URL, uploads it to Comfy Cloud, and runs the
workflow. The worker does NOT download or store the video itself — it only
resolves the URL (one yt-dlp metadata call per request).

## Notes

- No Instagram login/cookies are used; public reels only.
- Instagram blocks datacenter IPs aggressively — run this on a residential or
  cloud IP that yt-dlp accepts (test with `yt-dlp -g <reel-url>`).
- Reels are copyrighted by their creators: get permission/comply with
  Instagram's ToS for commercial use. A paid downloader API is the
  alternative when self-hosting is not possible.
