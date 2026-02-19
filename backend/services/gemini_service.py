import json
import asyncio
import logging
import httpx

logger = logging.getLogger("lecture-api.ai")

ENDPOINT = "https://models.github.ai/inference"
MODEL = "deepseek/DeepSeek-V3-0324"
MAX_INPUT_CHARS = 150_000

SUMMARIZE_PROMPT = """You are an expert academic summarizer. Given the following lecture transcript, generate three types of summaries.

Return your response as valid JSON with this exact structure:
{
  "quick": {
    "title": "Quick Summary",
    "points": ["point 1", "point 2", "...up to 10 bullet points of core ideas"]
  },
  "detailed": {
    "title": "Detailed Summary",
    "sections": [
      {
        "heading": "Topic/Concept Name",
        "content": "Structured explanation of this topic as covered in the lecture."
      }
    ]
  },
  "exam": {
    "title": "Exam-Focused Summary",
    "definitions": [
      {"term": "Term", "definition": "Clear definition"}
    ],
    "key_examples": ["Example 1 description", "Example 2 description"],
    "repeated_points": ["Points the lecturer emphasized or repeated"],
    "potential_questions": [
      {"question": "A likely exam question", "hint": "Brief answer hint"}
    ]
  }
}

Return ONLY the JSON, no markdown fences or extra text."""

NOTES_PROMPT = """You are an expert note-taking assistant. Transform the following lecture transcript into well-structured study notes.

Return your response as valid JSON with this exact structure:
{
  "title": "Lecture topic title inferred from content",
  "sections": [
    {
      "heading": "Topic Heading",
      "bullets": ["Key point 1", "Key point 2"],
      "definitions": [
        {"term": "Term", "definition": "Definition"}
      ],
      "highlights": ["Important statements worth memorizing"],
      "examples": ["Example or illustration mentioned"],
      "formulas": ["Any formulas or equations mentioned"]
    }
  ],
  "action_items": ["Any tasks, assignments, or things to follow up on"],
  "key_terms": [
    {"term": "Term", "definition": "Brief definition"}
  ]
}

Rules:
- Organize by topic, not chronologically
- Keep bullet points concise but complete
- Extract ALL definitions mentioned
- Flag any formulas, equations, or numerical relationships
- Identify examples and label them clearly
- Extract action items (assignments, readings, deadlines)
- The key_terms array should be a glossary of all important terms

Return ONLY the JSON, no markdown fences or extra text."""


def _clean_json_response(text: str) -> str:
    """Strip markdown fences and leading/trailing whitespace."""
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.index("\n")
        text = text[first_newline + 1:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


class GeminiService:
    def __init__(self, token: str):
        self.token = token

    async def _call_api(self, system_prompt: str, user_content: str) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.7,
            "top_p": 1.0,
            "max_tokens": 4096,
            "model": MODEL,
        }

        max_retries = 5
        for attempt in range(max_retries):
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{ENDPOINT}/chat/completions",
                    json=payload,
                    headers=headers,
                )

            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]

            if resp.status_code == 429 and attempt < max_retries - 1:
                wait = 2 ** attempt * 5
                await asyncio.sleep(wait)
                continue

            try:
                body = resp.json()
                error_msg = body.get("error", {}).get("message", resp.text[:300])
            except Exception:
                error_msg = resp.text[:300]
            raise RuntimeError(f"{resp.status_code}: {error_msg}")

        raise RuntimeError("Max retries exceeded")

    async def summarize(self, transcript: str) -> dict:
        transcript = transcript[:MAX_INPUT_CHARS]
        text = await self._call_api(SUMMARIZE_PROMPT, transcript)
        raw = _clean_json_response(text)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "quick": {"title": "Quick Summary", "points": [text]},
                "detailed": {"title": "Detailed Summary", "sections": []},
                "exam": {
                    "title": "Exam-Focused Summary",
                    "definitions": [],
                    "key_examples": [],
                    "repeated_points": [],
                    "potential_questions": [],
                },
            }

    async def generate_notes(self, transcript: str) -> dict:
        transcript = transcript[:MAX_INPUT_CHARS]
        text = await self._call_api(NOTES_PROMPT, transcript)
        raw = _clean_json_response(text)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "title": "Lecture Notes",
                "sections": [],
                "action_items": [],
                "key_terms": [],
            }
