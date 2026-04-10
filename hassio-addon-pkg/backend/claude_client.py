"""
Claude API wrapper for Envo.

Models used:
  - claude-sonnet-4-6: OCR/word extraction from images, conversation
  - claude-haiku-4-5-20251001: batch definition generation, example sentences
"""

import base64
import json
import re
from pathlib import Path
from typing import AsyncGenerator, Optional

import anthropic
from config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
async_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"


def extract_words_from_image(image_path: str) -> list[dict]:
    """
    Use Claude Vision to extract vocabulary words from a book page photo.
    Returns list of {word, part_of_speech, definition, example_sentence}.
    """
    image_data = Path(image_path).read_bytes()
    b64_image = base64.standard_b64encode(image_data).decode("utf-8")

    suffix = Path(image_path).suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    media_type = media_type_map.get(suffix, "image/jpeg")

    response = client.messages.create(
        model=SONNET,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a photo of a book page. Extract all English vocabulary words "
                            "that would be useful for a language learner to study.\n\n"
                            "For each word provide:\n"
                            "- word: lowercase, base/lemma form\n"
                            "- part_of_speech: noun/verb/adjective/adverb/etc\n"
                            "- definition: one clear sentence\n"
                            "- example_sentence: one natural example sentence using the word\n\n"
                            "Exclude: proper nouns, numbers, very common words (the, a, is, are, I, you, etc).\n"
                            "Focus on intermediate-to-advanced vocabulary worth studying.\n\n"
                            "Return ONLY a JSON array, no other text:\n"
                            '[{"word":"...","part_of_speech":"...","definition":"...","example_sentence":"..."}]'
                        ),
                    },
                ],
            }
        ],
    )

    text = response.content[0].text.strip()
    # Extract JSON array from response
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    return json.loads(match.group())


def generate_word_definitions(words: list[str]) -> list[dict]:
    """
    Batch generate definitions for a list of words using Haiku.
    Returns list of {word, part_of_speech, definition, example_sentence}.
    """
    word_list = "\n".join(f"- {w}" for w in words)

    response = client.messages.create(
        model=HAIKU,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": (
                    f"For each English word below, provide:\n"
                    f"- part_of_speech\n"
                    f"- definition (one sentence)\n"
                    f"- example_sentence\n\n"
                    f"Words:\n{word_list}\n\n"
                    f"Return ONLY a JSON array:\n"
                    f'[{{"word":"...","part_of_speech":"...","definition":"...","example_sentence":"..."}}]'
                ),
            }
        ],
    )

    text = response.content[0].text.strip()
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    return json.loads(match.group())


def generate_example_sentence(word: str, definition: str) -> str:
    """Generate a single example sentence for a word using Haiku."""
    response = client.messages.create(
        model=HAIKU,
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": (
                    f'Write one natural, clear example sentence for the word "{word}" '
                    f'({definition}). Return only the sentence, nothing else.'
                ),
            }
        ],
    )
    return response.content[0].text.strip()


def build_conversation_system_prompt(focus_words: list[dict]) -> str:
    """Build system prompt for conversation practice with focus vocabulary."""
    if focus_words:
        word_list = ", ".join(
            f"{w['word']} ({w.get('definition', '')})" for w in focus_words
        )
        vocab_instruction = (
            f"Today's focus vocabulary: {word_list}\n"
            "Naturally use these focus words in your responses when appropriate."
        )
    else:
        vocab_instruction = "Use varied, natural vocabulary in your responses."

    return f"""You are a friendly English conversation partner helping a language learner practice.

{vocab_instruction}

Rules:
1. Keep responses to 3-5 sentences — concise and conversational.
2. After your conversational reply, add a corrections section EXACTLY like this (always include it, even if no errors):

--- Corrections ---
[If no errors: write "Your English was perfect!"]
[If errors: bullet list, one per line: "• You wrote: X → Should be: Y (reason)"]

3. Be warm, encouraging, and patient.
4. If the learner seems to struggle, gently simplify your language."""


async def stream_conversation_response(
    messages: list[dict],
    focus_words: list[dict],
) -> AsyncGenerator[str, None]:
    """
    Stream a conversation response from Claude.
    Yields text chunks as they arrive.
    """
    system_prompt = build_conversation_system_prompt(focus_words)

    async with async_client.messages.stream(
        model=SONNET,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


def parse_corrections(full_response: str) -> tuple[str, list[dict]]:
    """
    Split assistant response into (conversational_reply, corrections_list).
    corrections_list: [{original, corrected, explanation}]
    """
    parts = full_response.split("--- Corrections ---", 1)
    reply = parts[0].strip()

    if len(parts) < 2:
        return reply, []

    corrections_text = parts[1].strip()

    if "perfect" in corrections_text.lower():
        return reply, []

    corrections = []
    for line in corrections_text.splitlines():
        line = line.strip().lstrip("•").strip()
        if not line:
            continue
        # Pattern: "You wrote: X → Should be: Y (reason)"
        match = re.match(r"You wrote:\s*(.+?)\s*→\s*Should be:\s*(.+?)(?:\s*\((.+)\))?$", line)
        if match:
            corrections.append({
                "original": match.group(1).strip(),
                "corrected": match.group(2).strip(),
                "explanation": match.group(3).strip() if match.group(3) else "",
            })

    return reply, corrections
