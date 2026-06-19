"""Tidy Agent — calls the local Hermes agent via its OpenAI-compatible API with streaming."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from enum import Enum, auto

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Tidy, an intelligent document parser built by Doc Tidy.

Your task:
1. Carefully read the document text provided by the user.
2. Think step-by-step about the document's structure and content inside <thinking> tags.
3. After your thinking, produce a single valid JSON object that captures the document's key structured data.

Rules:
- Always open your response with <thinking> and close with </thinking> before writing any JSON.
- The JSON must appear after the closing </thinking> tag with no markdown fencing.
- The JSON should be well-structured and comprehensive — extract all meaningful fields.
- Do not include explanatory text outside the <thinking> block or the JSON object.
"""


class TokenType(Enum):
    THINKING = auto()
    OUTPUT = auto()


@dataclass
class StreamChunk:
    token_type: TokenType
    content: str


async def stream_tidy(document_text: str) -> AsyncGenerator[StreamChunk, None]:
    """
    Stream the Tidy agent's response for the given document text.

    Connects to the local Hermes server at HERMES_BASE_URL using the OpenAI-compatible
    chat completions API.  Yields StreamChunk objects labelled THINKING or OUTPUT.
    THINKING chunks come from inside <thinking>…</thinking>.
    OUTPUT chunks are the JSON content that follows.
    """
    base_url = os.environ.get("HERMES_BASE_URL")
    if not base_url:
        raise EnvironmentError(
            "HERMES_BASE_URL is not set. "
            "Set it to your local Hermes server's OpenAI-compatible endpoint, "
            "e.g. http://localhost:8080/v1"
        )

    model = os.environ.get("HERMES_MODEL", "hermes3")

    # Local Hermes servers typically do not require a real API key.
    # The SDK requires a non-empty string, so we fall back to a placeholder.
    api_key = os.environ.get("HERMES_API_KEY", "not-needed")

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    logger.info("Calling Hermes model '%s' at %s", model, base_url)

    buffer = ""
    in_thinking = False
    thinking_done = False

    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Document text:\n\n{document_text}"},
        ],
        stream=True,
        temperature=0.2,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta is None:
            continue

        buffer += delta

        # Process buffer greedily
        while buffer:
            if not thinking_done:
                if not in_thinking:
                    # Look for <thinking> opening
                    tag_pos = buffer.find("<thinking>")
                    if tag_pos != -1:
                        pre = buffer[:tag_pos]
                        if pre:
                            # Text before <thinking> — treat as output (unlikely but safe)
                            yield StreamChunk(TokenType.OUTPUT, pre)
                        buffer = buffer[tag_pos + len("<thinking>"):]
                        in_thinking = True
                    else:
                        # Haven't found tag yet — hold partial if it could be a partial tag
                        if buffer.endswith("<") or buffer.endswith("<t") or \
                                buffer.endswith("<th") or buffer.endswith("<thi") or \
                                buffer.endswith("<thin") or buffer.endswith("<think") or \
                                buffer.endswith("<thinki") or buffer.endswith("<thinkin"):
                            break  # wait for more data
                        yield StreamChunk(TokenType.OUTPUT, buffer)
                        buffer = ""
                else:
                    # Inside <thinking> — look for </thinking>
                    close_pos = buffer.find("</thinking>")
                    if close_pos != -1:
                        thinking_chunk = buffer[:close_pos]
                        if thinking_chunk:
                            yield StreamChunk(TokenType.THINKING, thinking_chunk)
                        buffer = buffer[close_pos + len("</thinking>"):]
                        in_thinking = False
                        thinking_done = True
                    else:
                        # Check for partial closing tag at end
                        partial_match = _partial_close_suffix(buffer)
                        if partial_match:
                            safe = buffer[: len(buffer) - partial_match]
                            if safe:
                                yield StreamChunk(TokenType.THINKING, safe)
                            buffer = buffer[len(buffer) - partial_match :]
                            break
                        yield StreamChunk(TokenType.THINKING, buffer)
                        buffer = ""
            else:
                # All remaining content is JSON output
                yield StreamChunk(TokenType.OUTPUT, buffer)
                buffer = ""

    # Flush remaining buffer
    if buffer.strip():
        token_type = TokenType.THINKING if in_thinking else TokenType.OUTPUT
        yield StreamChunk(token_type, buffer)


def _partial_close_suffix(text: str) -> int:
    """Return the length of a potential partial </thinking> suffix at end of text."""
    close_tag = "</thinking>"
    for length in range(len(close_tag) - 1, 0, -1):
        if text.endswith(close_tag[:length]):
            return length
    return 0


def extract_json(output_text: str) -> dict:
    """
    Parse the JSON object from the model's output section.
    Handles stray whitespace and optional markdown fencing defensively.
    """
    text = output_text.strip()
    # Strip optional markdown fences
    text = re.sub(r"^```(?:json)?\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    text = text.strip()

    if not text:
        raise ValueError("Model produced empty output — no JSON to parse")

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        # Attempt to locate the first complete JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from model output: {exc}") from exc
