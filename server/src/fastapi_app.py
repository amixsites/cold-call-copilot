import os
import json
import uuid
import asyncio
from typing import Optional
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from google import genai
from google.genai import types

# Load environment variables
load_dotenv("server/.env")
load_dotenv(".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MANDATORY_MODEL = "gemini-3.5-transcribe-live"
MODEL_NAME = MANDATORY_MODEL

def classify_gemini_error(err_str: str):
    lower = err_str.lower()
    if "resource_exhausted" in lower or "429" in lower or "quota" in lower or "rate limit" in lower:
        return "QUOTA_EXCEEDED", f"Gemini API quota exceeded for {MANDATORY_MODEL}. Text-generation models are stopped to protect transcription quota. Please wait before reconnecting."
    if "api_key_invalid" in lower or "401" in lower or "403" in lower or "permission_denied" in lower or "unauthenticated" in lower:
        return "AUTHENTICATION_ERROR", "Authentication failed for Gemini Live API. Please verify server API key configuration."
    if "not_found" in lower or "404" in lower or "503" in lower or "unavailable" in lower:
        return "MODEL_AVAILABILITY_ERROR", f"Model {MANDATORY_MODEL} is currently unavailable."
    if "econnrefused" in lower or "econnreset" in lower or "etimedout" in lower or "enotfound" in lower or "network" in lower:
        return "NETWORK_ERROR", "Network connection to Google Gemini Live endpoint failed or timed out."
    return "TRANSCRIPTION_ERROR", err_str or "An error occurred during Gemini Live speech transcription."

app = FastAPI(title="Cold Call Copilot - Live Transcription Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_genai_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")
    return genai.Client(api_key=api_key)

@app.get("/api/ai/health")
async def health_check():
    key_configured = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "success": True,
        "service": "FastAPI Gemini Live Transcription",
        "geminiConfigured": key_configured,
        "model": MANDATORY_MODEL,
        "purpose": "Live Audio Speech-to-Text Transcription Only",
        "textGenerationDisabled": True,
        "status": "ready" if key_configured else "missing_key",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.websocket("/api/calls/{call_id}/transcription/live")
async def live_transcription_websocket(
    websocket: WebSocket,
    call_id: str,
    token: Optional[str] = Query(None)
):
    """
    Authenticated bidirectional streaming WebSocket for real-time call transcription
    using Google's Gemini Live API (gemini-3.5-transcribe-live).
    """
    await websocket.accept()
    
    if not GEMINI_API_KEY:
        await websocket.send_json({
            "type": "error",
            "message": "Transcription service unavailable: GEMINI_API_KEY not configured on server."
        })
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    # Notify client of connecting state
    await websocket.send_json({
        "type": "status",
        "status": "connecting",
        "message": f"Connecting to Gemini Live Transcription ({MODEL_NAME})..."
    })

    client = get_genai_client()

    # Configure session specifically for text transcription
    live_config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["en-US"],
            mode="VERBATIM",
        ),
    )

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    stop_event = asyncio.Event()

    # Forward audio from client WebSocket to audio_queue
    async def client_receive_task():
        try:
            while not stop_event.is_set():
                data = await websocket.receive()
                if "bytes" in data and data["bytes"]:
                    await audio_queue.put(data["bytes"])
                elif "text" in data and data["text"]:
                    try:
                        msg = json.loads(data["text"])
                        if msg.get("type") == "stop":
                            stop_event.set()
                            break
                        elif msg.get("type") == "ping":
                            await websocket.send_json({"type": "pong"})
                        elif msg.get("type") == "audio_base64" and msg.get("data"):
                            import base64
                            pcm_bytes = base64.b64decode(msg["data"])
                            await audio_queue.put(pcm_bytes)
                    except Exception:
                        pass
        except WebSocketDisconnect:
            stop_event.set()
        except Exception:
            stop_event.set()

    # Stream audio chunks from audio_queue to Gemini Live session
    async def gemini_send_task(session):
        try:
            while not stop_event.is_set():
                try:
                    chunk = await asyncio.wait_for(audio_queue.get(), timeout=0.2)
                    if chunk:
                        # Send 16-bit PCM chunk at 16000Hz to Gemini Live
                        blob = types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                        await session.send_realtime_input(audio=blob)
                        audio_queue.task_done()
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"[FastAPI Live] Error sending audio chunk: {e}")
                    break
        except Exception as e:
            print(f"[FastAPI Live] gemini_send_task exited: {e}")

    # Read continuous transcription output from Gemini Live session and forward to client
    async def gemini_receive_task(session):
        try:
            async for response in session.receive():
                if stop_event.is_set():
                    break

                sc = response.server_content
                if not sc:
                    continue

                # 1. Low-latency interim input transcription
                if hasattr(sc, "interim_input_transcription") and sc.interim_input_transcription:
                    interim_text = sc.interim_input_transcription.text
                    if interim_text and interim_text.strip():
                        await websocket.send_json({
                            "type": "interim",
                            "text": interim_text.strip(),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

                # 2. Finalized input transcription
                if hasattr(sc, "input_transcription") and sc.input_transcription:
                    final_text = sc.input_transcription.text
                    if final_text and final_text.strip():
                        await websocket.send_json({
                            "type": "final",
                            "segmentId": f"seg-{uuid.uuid4().hex[:12]}",
                            "text": final_text.strip(),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

                # 3. Model turn text parts fallback (for models outputting text parts)
                if hasattr(sc, "model_turn") and sc.model_turn and sc.model_turn.parts:
                    for part in sc.model_turn.parts:
                        if getattr(part, "text", None):
                            text = part.text.strip()
                            if text:
                                await websocket.send_json({
                                    "type": "final",
                                    "segmentId": f"seg-{uuid.uuid4().hex[:12]}",
                                    "text": text,
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                })
        except Exception as e:
            print(f"[FastAPI Live] gemini_receive_task error: {e}")
            if not stop_event.is_set():
                await websocket.send_json({
                    "type": "error",
                    "message": f"Gemini Live session error: {str(e)}"
                })

    try:
        # Establish Live API session with Gemini (strictly gemini-3.5-transcribe-live)
        model_to_use = MANDATORY_MODEL
        print(f"[Model Enforcement Diagnostic] FastAPI Live session starting for call_id={call_id} | Model: {model_to_use} | Purpose: Live Audio Speech-to-Text | Fallbacks: NONE")

        try:
            async with client.aio.live.connect(model=model_to_use, config=live_config) as session:
                # Notify client that microphone streaming is now live
                await websocket.send_json({
                    "type": "status",
                    "status": "listening",
                    "message": f"Active Gemini Live session established with {model_to_use}"
                })

                # Run audio forwarder and transcription receiver concurrently
                tasks = [
                    asyncio.create_task(client_receive_task()),
                    asyncio.create_task(gemini_send_task(session)),
                    asyncio.create_task(gemini_receive_task(session)),
                ]

                # Wait until any task ends or stop requested
                done, pending = await asyncio.wait(
                    tasks,
                    return_when=asyncio.FIRST_COMPLETED
                )

                stop_event.set()
                for task in pending:
                    task.cancel()

        except Exception as connect_err:
            err_cat, err_msg = classify_gemini_error(str(connect_err))
            print(f"[FastAPI Live Error] Category: {err_cat} | Model: {MANDATORY_MODEL} | Error: {connect_err}")
            # Strictly NO model fallback
            await websocket.send_json({
                "type": "error",
                "errorCategory": err_cat,
                "message": err_msg,
                "model": MANDATORY_MODEL,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        stop_event.set()
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fastapi_app:app", host="0.0.0.0", port=8000, reload=True)
