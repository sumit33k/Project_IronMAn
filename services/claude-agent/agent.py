"""
Jarvis Claude Agent — works on the Project Iron Man repo with prompt caching.

Prompt caching strategy:
  1. Stable cached block: repo context docs + system prompt (cache_control on last block)
  2. Volatile block: the user's task (not cached)

Cache economics (Opus 4.7):
  - Write: 1.25× base input price  (~$6.25/1M)
  - Read:  0.1× base input price   (~$0.50/1M)
  - Break-even: ~2 requests for 5-min cache TTL
"""

from __future__ import annotations

import dataclasses
import os
from pathlib import Path
from typing import Any

import anthropic

from config import settings
from tools import TOOL_DEFINITIONS, handle_tool


@dataclasses.dataclass
class TokenStats:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def cache_hit_rate(self) -> float:
        cacheable = self.cache_creation_tokens + self.cache_read_tokens
        if cacheable == 0:
            return 0.0
        return self.cache_read_tokens / cacheable

    def update(self, usage: anthropic.types.Usage) -> None:
        self.input_tokens += usage.input_tokens
        self.output_tokens += usage.output_tokens
        self.cache_creation_tokens += getattr(usage, "cache_creation_input_tokens", 0) or 0
        self.cache_read_tokens += getattr(usage, "cache_read_input_tokens", 0) or 0

    def summary(self) -> str:
        return (
            f"Tokens — input: {self.input_tokens:,} | output: {self.output_tokens:,} | "
            f"cache_writes: {self.cache_creation_tokens:,} | cache_reads: {self.cache_read_tokens:,} | "
            f"cache_hit_rate: {self.cache_hit_rate:.1%}"
        )


def _load_context_file(path: str, repo_root: str) -> str | None:
    full = Path(repo_root) / path
    if full.exists():
        return full.read_text(encoding="utf-8", errors="replace")
    return None


def _build_cached_system_block(repo_root: str) -> list[anthropic.types.TextBlockParam]:
    """
    Build the stable system blocks to be prompt-cached.

    Ordering rule: stable content first, volatile content last.
    cache_control is placed on the LAST block so everything before it is cached as one prefix.
    """
    context_files = [
        ("docs/ARCHITECTURE.md", "Architecture"),
        ("docs/AGENT_DESIGN.md", "Agent Design"),
        ("docs/SECURITY.md", "Security"),
        ("CLAUDE.md", "Claude Code Config"),
    ]

    parts: list[str] = []
    for file_path, label in context_files:
        content = _load_context_file(file_path, repo_root)
        if content:
            parts.append(f"=== {label} ({file_path}) ===\n{content}")

    repo_context = "\n\n".join(parts)

    base_instructions = """You are an expert full-stack engineer working on Project Iron Man — a local-first AI
productivity cockpit with a FastAPI backend, Next.js 14 frontend, SQLite database, and a
modular AI agent framework powered by Ollama.

## Project Invariants
- Local-first: all data stays on device; no cloud AI without explicit opt-in
- Human approval gate: email send, file delete, calendar write always require confirmation
- Always call agent.execute(), never agent.run() directly (execute() handles AgentRun lifecycle)
- FastAPI route order: /runs/all must be declared BEFORE /{agent_id}
- Agent run() always returns a dict — never free-form text
- Risk levels: low (no confirmation), medium (recommended), high (always confirm)

## Code Style
- Python: type hints everywhere, async/await for I/O, Pydantic schemas for request/response
- TypeScript: strict mode, 'use client' directive for interactive components, @/* path alias
- No comments explaining WHAT code does — only WHY (hidden constraints, non-obvious invariants)
- Prefer editing existing files over creating new ones
- No features beyond what the task requires

## Available Tools
- read_file: read any repo file by relative path
- list_files: list files in a directory with optional glob pattern
- write_file: write/overwrite a file (always confirm before writing production code)
- run_command: run shell command in repo root (prefer read-only)
- call_api: call Jarvis API at http://localhost:8000

Respond with precise, working code. Check existing patterns before adding new ones."""

    blocks: list[anthropic.types.TextBlockParam] = [
        {"type": "text", "text": f"## Repository Context\n\n{repo_context}\n\n## Instructions\n\n{base_instructions}"},
    ]

    # cache_control on the last block caches the entire prefix
    blocks[-1]["cache_control"] = {"type": "ephemeral"}  # type: ignore[typeddict-unknown-key]

    return blocks


class JarvisClaudeAgent:
    """
    Claude agent for working on the Jarvis Command Center repo.

    The system prompt (repo docs + instructions) is prompt-cached on the first request
    and read from cache on subsequent requests — dramatically reducing input token cost
    for repeated invocations within the 5-minute cache TTL.
    """

    def __init__(self, repo_root: str | None = None, api_key: str | None = None) -> None:
        self.repo_root = repo_root or settings.repo_root
        self.client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", ""))
        self.model = settings.model
        self._cached_system: list[anthropic.types.TextBlockParam] | None = None
        self.stats = TokenStats()

    def _get_system(self) -> list[anthropic.types.TextBlockParam]:
        if self._cached_system is None:
            self._cached_system = _build_cached_system_block(self.repo_root)
        return self._cached_system

    def run(self, task: str, max_turns: int = 20) -> str:
        """
        Run a task on the repo. Streams output, handles tool calls, returns final text.

        Args:
            task: Natural language description of what to do in the repo.
            max_turns: Maximum agentic loop iterations before stopping.
        """
        messages: list[anthropic.types.MessageParam] = [
            {"role": "user", "content": task},
        ]

        final_text = ""
        for turn in range(max_turns):
            with self.client.messages.stream(
                model=self.model,
                max_tokens=16384,
                thinking={"type": "adaptive"},
                output_config={"effort": "xhigh"},
                system=self._get_system(),  # type: ignore[arg-type]
                tools=TOOL_DEFINITIONS,
                messages=messages,
            ) as stream:
                response = stream.get_final_message()

            self.stats.update(response.usage)
            if settings.log_token_usage:
                print(f"[turn {turn + 1}] {self.stats.summary()}")

            # Collect text from this response
            for block in response.content:
                if block.type == "text":
                    final_text = block.text

            if response.stop_reason == "end_turn":
                break

            if response.stop_reason != "tool_use":
                break

            # Execute tool calls
            tool_results: list[anthropic.types.ToolResultBlockParam] = []
            for block in response.content:
                if block.type == "tool_use":
                    result = handle_tool(block.name, block.input, self.repo_root, settings.jarvis_api_url)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return final_text

    def token_report(self) -> dict[str, Any]:
        return {
            "input_tokens": self.stats.input_tokens,
            "output_tokens": self.stats.output_tokens,
            "cache_creation_tokens": self.stats.cache_creation_tokens,
            "cache_read_tokens": self.stats.cache_read_tokens,
            "cache_hit_rate": f"{self.stats.cache_hit_rate:.1%}",
            "total_tokens": self.stats.total_tokens,
        }
