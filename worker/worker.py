"""
Doc Tidy Worker
---------------
Connects to the Express server via WebSocket, receives job assignments,
processes PDFs with pdfplumber, streams the Tidy agent response back,
and persists results to MongoDB.

Run:
    python worker.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime

import motor.motor_asyncio
from bson import ObjectId
from dotenv import load_dotenv
from websockets.asyncio.client import connect as ws_connect
from websockets.exceptions import ConnectionClosed

from pdf_extractor import extract_text
from tidy_agent import TokenType, extract_json, stream_tidy

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

SERVER_WS_URL = os.environ["SERVER_WS_URL"]  # e.g. ws://localhost:3001/ws
MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ.get("MONGODB_DB", "doc-tidy")
RECONNECT_DELAY = 5  # seconds between reconnect attempts


def get_motor_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    return motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)


async def fetch_pdf_bytes(db: motor.motor_asyncio.AsyncIOMotorDatabase, job_id: str) -> bytes:
    """Download PDF bytes from MongoDB GridFS."""
    import motor.motor_asyncio
    from gridfs import GridIn  # noqa: F401 — for type hints only

    bucket = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db, bucket_name="pdfs")

    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job or not job.get("pdfFileId"):
        raise ValueError(f"No PDF file reference found for job {job_id}")

    chunks: list[bytes] = []
    async with await bucket.open_download_stream(job["pdfFileId"]) as stream:
        async for chunk in stream:
            chunks.append(chunk)
    return b"".join(chunks)


async def process_job(
    job_id: str,
    ws,
    db: motor.motor_asyncio.AsyncIOMotorDatabase,
) -> None:
    """Full pipeline: fetch PDF → extract text → stream Tidy → persist result."""
    logger.info("Processing job %s", job_id)

    async def send(payload: dict) -> None:
        await ws.send(json.dumps(payload))

    try:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "processing"}},
        )
        await send({"type": "status", "jobId": job_id, "status": "processing"})

        pdf_bytes = await fetch_pdf_bytes(db, job_id)
        logger.info("Job %s: PDF fetched (%d bytes)", job_id, len(pdf_bytes))

        document_text = extract_text(pdf_bytes)
        logger.info("Job %s: text extracted (%d chars)", job_id, len(document_text))

        output_buffer = ""

        async for chunk in stream_tidy(document_text):
            token_type_str: str = (
                "thinking" if chunk.token_type == TokenType.THINKING else "output"
            )
            await send({
                "type": "token",
                "jobId": job_id,
                "tokenType": token_type_str,
                "content": chunk.content,
            })

            if chunk.token_type == TokenType.OUTPUT:
                output_buffer += chunk.content

        logger.info("Job %s: stream complete, parsing JSON", job_id)
        result_json = extract_json(output_buffer)

        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": "completed",
                    "jsonOutput": result_json,
                    "completedAt": datetime.utcnow(),
                }
            },
        )
        await send({"type": "complete", "jobId": job_id, "json": result_json})
        logger.info("Job %s: completed", job_id)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed", "error": str(exc)}},
        )
        await send({"type": "error", "jobId": job_id, "message": str(exc)})


async def run_worker() -> None:
    """Connect to the server and handle incoming job messages."""
    mongo_client = get_motor_client()
    db = mongo_client[MONGODB_DB]

    while True:
        try:
            logger.info("Connecting to %s…", SERVER_WS_URL)
            async with ws_connect(
                SERVER_WS_URL,
                ping_interval=20,   # send a ping every 20s to keep Railway's proxy alive
                ping_timeout=10,    # wait up to 10s for a pong before treating as dead
            ) as ws:
                logger.info("Connected to server")
                await ws.send(json.dumps({"type": "ready"}))

                active_tasks: set[asyncio.Task] = set()

                async for raw_message in ws:
                    try:
                        msg = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.warning("Received non-JSON message: %s", raw_message)
                        continue

                    msg_type = msg.get("type")

                    if msg_type == "job":
                        job_id: str = msg["jobId"]
                        task = asyncio.create_task(process_job(job_id, ws, db))
                        active_tasks.add(task)
                        task.add_done_callback(active_tasks.discard)

                    else:
                        logger.debug("Unhandled message type: %s", msg_type)

        except ConnectionClosed as exc:
            logger.warning("WebSocket closed (%s), reconnecting in %ds…", exc, RECONNECT_DELAY)
        except OSError as exc:
            logger.warning("Connection error (%s), reconnecting in %ds…", exc, RECONNECT_DELAY)
        except Exception:
            logger.exception("Unexpected error, reconnecting in %ds…", RECONNECT_DELAY)

        await asyncio.sleep(RECONNECT_DELAY)


def main() -> None:
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        sys.exit(0)


if __name__ == "__main__":
    main()
