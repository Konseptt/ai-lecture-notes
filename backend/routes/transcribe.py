import os
import json
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query


logger = logging.getLogger("lecture-api.transcribe")
router = APIRouter()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&language=en"
    "&punctuate=true"
    "&interim_results=true"
    "&utterance_end_ms=1000"
    "&filler_words=true"
    "&smart_format=false"
)


@router.websocket("/api/ws/transcribe")
async def transcribe_ws(ws: WebSocket, token: str = Query("")):
    if not token:
        await ws.close(code=4001, reason="Missing token")
        return

    try:
        import jwt as pyjwt
        from auth import JWT_SECRET, JWT_ALGORITHM
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if not payload.get("sub"):
            await ws.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await ws.close(code=4001, reason="Invalid token")
        return

    await ws.accept()

    if not DEEPGRAM_API_KEY:
        await ws.send_json({"type": "fallback", "message": "Deepgram not configured, use browser speech"})
        await ws.close()
        return

    try:
        import websockets

        async with websockets.connect(
            DEEPGRAM_WS_URL,
            additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
        ) as dg:
            await ws.send_json({"type": "ready"})

            async def client_to_deepgram():
                try:
                    while True:
                        data = await ws.receive_bytes()
                        await dg.send(data)
                except WebSocketDisconnect:
                    try:
                        await dg.send(json.dumps({"type": "CloseStream"}))
                    except Exception:
                        pass
                except Exception:
                    pass

            async def deepgram_to_client():
                try:
                    async for msg in dg:
                        try:
                            data = json.loads(msg)
                            if data.get("type") == "Results":
                                alt = data.get("channel", {}).get("alternatives", [{}])[0]
                                text = alt.get("transcript", "")
                                if text:
                                    words = alt.get("words", [])
                                    start_sec = words[0]["start"] if words else data.get("start", 0)
                                    await ws.send_json({
                                        "type": "transcript",
                                        "text": text,
                                        "is_final": data.get("is_final", False),
                                        "speech_final": data.get("speech_final", False),
                                        "start": start_sec,
                                    })
                        except (json.JSONDecodeError, KeyError):
                            pass
                except Exception:
                    pass

            done, pending = await asyncio.wait(
                [asyncio.create_task(client_to_deepgram()), asyncio.create_task(deepgram_to_client())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()

    except Exception as e:
        logger.exception("Transcription WebSocket error")
        try:
            await ws.send_json({"type": "error", "message": "Transcription service unavailable"})
        except Exception:
            pass
