import re

import uvicorn
from fastapi import FastAPI, Query

app = FastAPI(title="reel-resolver")


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/resolve")
async def resolve(url: str = Query(..., description="Instagram reel URL")):
    if not re.match(r"^https?://(www\.)?instagram\.com/", url):
        return {"error": "only instagram.com links are supported"}

    import yt_dlp  # imported lazily — startup stays fast

    with yt_dlp.YoutubeDL({"quiet": True, "noplaylist": True, "skip_download": True}) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
        except Exception as e:
            return {"error": f"extract failed: {str(e)[:300]}"}

    entries = info.get("entries") or [info]
    for entry in entries:
        if entry.get("_type") == "url":
            entry = ydl.extract_info(entry["url"], download=False)
        # Prefer the merged/best video+audio URL; fall back to the video stream.
        video_url = entry.get("url") or (entry.get("formats") or [{}])[-1].get("url")
        if video_url:
            return {"video_url": video_url, "title": entry.get("title", "")}
    return {"error": "no video URL found"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
