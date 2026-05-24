"""
Example usage of the Jarvis Claude Agent.

Run from the repo root:
    cd /path/to/project_ironman
    ANTHROPIC_API_KEY=sk-... python services/claude-agent/example_usage.py

Or with a .env file in services/claude-agent/:
    echo "CLAUDE_AGENT_ANTHROPIC_API_KEY=sk-..." > services/claude-agent/.env
    python services/claude-agent/example_usage.py
"""

import json
import os
import sys

# Allow running from any directory by adding the service dir to path
sys.path.insert(0, os.path.dirname(__file__))

from agent import JarvisClaudeAgent


def demo_cache_warmup(agent: JarvisClaudeAgent) -> None:
    """First call writes the cache; subsequent calls read from it."""
    print("=" * 60)
    print("Task 1 — Read the codebase (warms prompt cache)")
    print("=" * 60)

    result = agent.run("List all Python files in the apps/api directory and tell me the purpose of each route file.")
    print("\nResult:", result[:500], "...\n" if len(result) > 500 else "\n")
    print("Token report (Task 1):", json.dumps(agent.token_report(), indent=2))
    print()


def demo_cache_hit(agent: JarvisClaudeAgent) -> None:
    """Second call reuses the cached system prompt — cache_read_tokens should be high."""
    print("=" * 60)
    print("Task 2 — Different question, same agent (cache hit expected)")
    print("=" * 60)

    result = agent.run("Show me the BaseAgent class in apps/api/app/agents/base.py and explain the execute() method.")
    print("\nResult:", result[:500], "...\n" if len(result) > 500 else "\n")
    print("Token report (Task 2, cumulative):", json.dumps(agent.token_report(), indent=2))
    print()


def demo_code_task(agent: JarvisClaudeAgent) -> None:
    """A real coding task — reads files, proposes changes."""
    print("=" * 60)
    print("Task 3 — Code analysis task")
    print("=" * 60)

    result = agent.run(
        "Read apps/api/app/routes/agents.py and verify that the /runs/all route is declared "
        "before the /{agent_id} route. If it is, confirm. If not, explain what fix is needed "
        "and show the corrected route order (do NOT write the file — just show the fix)."
    )
    print("\nResult:", result)
    print()
    print("Final token report:", json.dumps(agent.token_report(), indent=2))


if __name__ == "__main__":
    # Repo root is two levels up from this file: services/claude-agent/ -> repo root
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    print(f"Repo root: {repo_root}")

    agent = JarvisClaudeAgent(repo_root=repo_root)

    demo_cache_warmup(agent)
    demo_cache_hit(agent)
    demo_code_task(agent)

    print("=" * 60)
    print("All tasks complete.")
    print("If cache_read_tokens > 0 on Task 2+, prompt caching is working.")
