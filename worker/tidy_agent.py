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

# Hard cap on document text sent to the model.  Most invoices are well under
# this limit; it guards against multi-page PDFs stalling the local LLM.
MAX_DOCUMENT_CHARS = int(os.environ.get("MAX_DOCUMENT_CHARS", 12_000))

# Request timeout in seconds.  Local Ollama models should finish a typical
# invoice well within 90 s; raise via MAX_RESPONSE_TIMEOUT env var if needed.
REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", 90))

# Maximum tokens the model may generate per request.
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", 2048))

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
    # base_url is optional — omit it when pointing at the real OpenAI API.
    base_url = os.environ.get("HERMES_BASE_URL") or None
    model = os.environ.get("HERMES_MODEL", "hermes3")
    api_key = os.environ.get("HERMES_API_KEY", "not-needed")

    client_kwargs: dict = {"api_key": api_key, "timeout": REQUEST_TIMEOUT}
    if base_url:
        client_kwargs["base_url"] = base_url

    client = AsyncOpenAI(**client_kwargs)

    if len(document_text) > MAX_DOCUMENT_CHARS:
        logger.warning(
            "Document text is %d chars — truncating to %d",
            len(document_text),
            MAX_DOCUMENT_CHARS,
        )
        document_text = document_text[:MAX_DOCUMENT_CHARS] + "\n\n[... truncated ...]"

    logger.info("Calling Hermes model '%s' at %s", model, base_url)

    buffer = ""
    in_thinking = False
    thinking_done = False

    # temperature is not supported by OpenAI reasoning models (e.g. gpt-5.5).
    # Omit it universally — the system prompt guides determinism sufficiently.
    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Document text:\n\n{document_text}"},
        ],
        stream=True,
        max_tokens=MAX_TOKENS,
    )

    async for chunk in stream:
        # Some OpenAI-compatible backends emit chunks with no usable choice —
        # e.g. usage-only final frames, keep-alive frames, or partial frames
        # under load — where `choices` is None or empty (and occasionally the
        # `delta` itself is None).  Indexing those raised
        # `TypeError: 'NoneType' object is not subscriptable`, which surfaced
        # intermittently and cleared on retry.  Skip anything without a delta.
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta is None:
            continue

        # Reasoning models (e.g. GPT-5.5, Hermes thinking) stream their
        # chain-of-thought in a dedicated `reasoning_content` (or `reasoning`)
        # field rather than inside <thinking> tags in `content`.  Surface it
        # directly as THINKING so the reasoning panel populates.
        reasoning = _extract_reasoning(delta)
        if reasoning:
            yield StreamChunk(TokenType.THINKING, reasoning)

        content = delta.content
        if content is None:
            continue

        buffer += content

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


def _extract_reasoning(delta) -> str | None:
    """
    Pull chain-of-thought text out of a streaming delta for reasoning models.

    OpenAI-compatible reasoning backends expose it as `reasoning_content`; some
    use `reasoning`.  Newer/older SDK versions may stash unknown fields in
    `model_extra` rather than as direct attributes, so check there too.
    """
    for attr in ("reasoning_content", "reasoning"):
        value = getattr(delta, attr, None)
        if value:
            return value

    extra = getattr(delta, "model_extra", None) or {}
    for key in ("reasoning_content", "reasoning"):
        value = extra.get(key)
        if value:
            return value

    return None


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
