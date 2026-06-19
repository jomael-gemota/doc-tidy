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
import time
from datetime import datetime

import motor.motor_asyncio
from bson import ObjectId
from dotenv import load_dotenv
from websockets.asyncio.client import connect as ws_connect
from websockets.exceptions import ConnectionClosed

from narrator import Narrator
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


def _human_size(num_bytes: int) -> str:
    """Format a byte count as a short human-readable string."""
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


async def fetch_pdf_bytes(db: motor.motor_asyncio.AsyncIOMotorDatabase, job_id: str) -> bytes:
    """Download PDF bytes from MongoDB GridFS."""
    bucket = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db, bucket_name="pdfs")

    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job or not job.get("pdfFileId"):
        raise ValueError(f"No PDF file reference found for job {job_id}")

    stream = await bucket.open_download_stream(job["pdfFileId"])
    return await stream.read()


async def process_job(
    job_id: str,
    ws,
    db: motor.motor_asyncio.AsyncIOMotorDatabase,
) -> None:
    """Full pipeline: fetch PDF → extract text → stream Tidy → persist result.

    Each stage is narrated into the reasoning panel as a `thinking` token so the
    UI shows a step-by-step pipeline top to bottom, even when the model itself
    exposes no chain-of-thought.
    """
    logger.info("Processing job %s", job_id)
    started = time.monotonic()

    async def send(payload: dict) -> None:
        await ws.send(json.dumps(payload))

    narrator = Narrator()
    step_counter = 0

    async def emit_thinking(text: str) -> None:
        """Emit a raw thinking token into the reasoning panel."""
        await send({
            "type": "token",
            "jobId": job_id,
            "tokenType": "thinking",
            "content": text,
        })

    async def say_intro(intent: str, fallback: str) -> None:
        """Tidy's opening line, standing on its own above the steps."""
        line = await narrator.say(intent, fallback)
        await emit_thinking(f"{line}\n\n")

    async def step_start(intent: str, fallback: str) -> None:
        """Begin a numbered step: '<n>. <Tidy line>'."""
        nonlocal step_counter
        step_counter += 1
        line = await narrator.say(intent, fallback)
        await emit_thinking(f"{step_counter}. {line}\n")

    async def step_done(intent: str, fallback: str) -> None:
        """Close the current step with an indented Tidy line."""
        line = await narrator.say(intent, fallback)
        await emit_thinking(f"   {line}\n\n")

    try:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "processing"}},
        )
        await send({"type": "status", "jobId": job_id, "status": "processing"})

        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
        filename = (job or {}).get("filename", "document.pdf")
        await say_intro(
            f"You just handed me a document named '{filename}'. Greet briefly and say "
            f"you're taking a look.",
            f"Hi! I've got your document, {filename} — let me take a look.",
        )

        await step_start(
            "Tell the user you're now fetching their PDF from storage.",
            "Let me grab your PDF from storage...",
        )
        pdf_bytes = await fetch_pdf_bytes(db, job_id)
        logger.info("Job %s: PDF fetched (%d bytes)", job_id, len(pdf_bytes))
        size_str = _human_size(len(pdf_bytes))
        await step_done(
            f"You just finished loading the PDF and it is {size_str}.",
            f"Got it — that's {size_str} loaded and ready.",
        )

        await step_start(
            "Tell the user you're now reading the text off the pages.",
            "Now I'll read the text from the pages...",
        )
        document_text = extract_text(pdf_bytes)
        logger.info("Job %s: text extracted (%d chars)", job_id, len(document_text))
        char_str = f"{len(document_text):,}"
        await step_done(
            f"You just extracted the text and it came to {char_str} characters.",
            f"Done — I pulled out {char_str} characters of text.",
        )

        await step_start(
            "Tell the user that you yourself are now reading through and making sense "
            "of the document. You are doing this work directly — do not mention any "
            "separate model, parser, or tool.",
            "Now let me read through and make sense of it...",
        )

        output_buffer = ""
        saw_reasoning = False

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
            else:
                saw_reasoning = True

        if saw_reasoning:
            await step_done(
                "Tell the user you've finished working through the document.",
                "Okay — I've worked through the details.",
            )
        else:
            await step_done(
                "Tell the user you went straight to the answer without showing your "
                "working this time.",
                "I went straight to the answer on this one.",
            )

        await step_start(
            "Tell the user you're now organizing everything into clean structured data.",
            "Now let me tidy this into clean, structured data...",
        )
        logger.info("Job %s: stream complete, parsing JSON", job_id)
        result_json = extract_json(output_buffer)
        await step_done(
            "Tell the user the structured data is ready and valid.",
            "All set — your structured data is ready and valid.",
        )

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
        elapsed_str = f"{time.monotonic() - started:.1f}"
        await say_intro(
            f"Tell the user you finished the whole job in {elapsed_str} seconds.",
            f"Finished in {elapsed_str}s — here's everything I found.",
        )
        await send({"type": "complete", "jobId": job_id, "json": result_json})
        logger.info("Job %s: completed", job_id)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed", "error": str(exc)}},
        )
        try:
            await emit_thinking(f"\nSorry — I ran into a problem: {exc}\n")
        except Exception:
            pass
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
