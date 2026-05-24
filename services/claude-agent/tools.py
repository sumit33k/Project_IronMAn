"""Tool definitions and handlers for the Jarvis Claude agent."""

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import anthropic
import httpx

TOOL_DEFINITIONS: list[anthropic.types.ToolParam] = [
    {
        "name": "read_file",
        "description": "Read the contents of a file in the repository.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path relative to repo root"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": "List files in the repository matching an optional glob pattern.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Directory to list (relative to repo root)", "default": "."},
                "pattern": {"type": "string", "description": "Glob pattern to filter files (e.g. '**/*.py')"},
            },
            "required": [],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file in the repository. Will overwrite if the file exists.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path relative to repo root"},
                "content": {"type": "string", "description": "File content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a shell command in the repository root. Prefer read-only commands.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to run"},
                "timeout": {"type": "integer", "description": "Timeout in seconds (default 30)", "default": 30},
            },
            "required": ["command"],
        },
    },
    {
        "name": "call_api",
        "description": "Call the local Jarvis API (http://localhost:8000). Returns the JSON response.",
        "input_schema": {
            "type": "object",
            "properties": {
                "method": {"type": "string", "enum": ["GET", "POST", "PATCH", "DELETE"]},
                "path": {"type": "string", "description": "API path (e.g. /agents, /tasks)"},
                "body": {"type": "object", "description": "Request body for POST/PATCH"},
            },
            "required": ["method", "path"],
        },
    },
]


def handle_tool(name: str, tool_input: dict[str, Any], repo_root: str, api_url: str) -> str:
    try:
        if name == "read_file":
            return _read_file(tool_input["path"], repo_root)
        elif name == "list_files":
            return _list_files(tool_input.get("directory", "."), tool_input.get("pattern"), repo_root)
        elif name == "write_file":
            return _write_file(tool_input["path"], tool_input["content"], repo_root)
        elif name == "run_command":
            return _run_command(tool_input["command"], tool_input.get("timeout", 30), repo_root)
        elif name == "call_api":
            return _call_api(tool_input["method"], tool_input["path"], tool_input.get("body"), api_url)
        else:
            return f"Unknown tool: {name}"
    except Exception as e:
        return f"Error executing {name}: {e}"


def _read_file(path: str, repo_root: str) -> str:
    full = Path(repo_root) / path
    if not full.exists():
        return f"File not found: {path}"
    if full.stat().st_size > 500_000:
        return f"File too large to read (>{500_000} bytes): {path}"
    return full.read_text(encoding="utf-8", errors="replace")


def _list_files(directory: str, pattern: str | None, repo_root: str) -> str:
    base = Path(repo_root) / directory
    if not base.exists():
        return f"Directory not found: {directory}"
    if pattern:
        files = sorted(str(p.relative_to(repo_root)) for p in base.glob(pattern) if p.is_file())
    else:
        files = sorted(str(p.relative_to(repo_root)) for p in base.iterdir() if p.is_file())
    return "\n".join(files) if files else "(no files found)"


def _write_file(path: str, content: str, repo_root: str) -> str:
    full = Path(repo_root) / path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return f"Written: {path} ({len(content)} bytes)"


def _run_command(command: str, timeout: int, repo_root: str) -> str:
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=repo_root,
    )
    output = result.stdout
    if result.stderr:
        output += f"\nSTDERR:\n{result.stderr}"
    if result.returncode != 0:
        output += f"\nExit code: {result.returncode}"
    return output or "(no output)"


def _call_api(method: str, path: str, body: dict | None, api_url: str) -> str:
    url = api_url.rstrip("/") + "/" + path.lstrip("/")
    with httpx.Client(timeout=30) as client:
        if method == "GET":
            resp = client.get(url)
        elif method == "POST":
            resp = client.post(url, json=body or {})
        elif method == "PATCH":
            resp = client.patch(url, json=body or {})
        elif method == "DELETE":
            resp = client.delete(url)
        else:
            return f"Unsupported method: {method}"
    try:
        return json.dumps(resp.json(), indent=2)
    except Exception:
        return resp.text
