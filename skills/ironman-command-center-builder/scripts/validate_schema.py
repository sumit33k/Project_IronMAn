#!/usr/bin/env python3
"""Validate API schemas, routes, and agents are syntactically correct.
Run from repo root: python skills/ironman-command-center-builder/scripts/validate_schema.py
"""
import sys
import ast
from pathlib import Path


def parse_file(f: Path) -> list[str]:
    try:
        tree = ast.parse(f.read_text())
        return [n.name for n in ast.walk(tree) if isinstance(n, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))]
    except SyntaxError as e:
        return [f"SYNTAX_ERROR: {e}"]


def check_dir(label: str, directory: Path, check_fn=None) -> list[str]:
    errors = []
    if not directory.exists():
        errors.append(f"Missing directory: {directory}")
        return errors
    print(f"\n=== {label} ===")
    for f in sorted(directory.glob("*.py")):
        if f.name == "__init__.py":
            continue
        names = parse_file(f)
        errs = [n for n in names if n.startswith("SYNTAX_ERROR")]
        if errs:
            print(f"  ✗ {f.name}: {errs[0]}")
            errors.extend(errs)
        else:
            print(f"  ✓ {f.name}: {', '.join(n for n in names if not n.startswith('_'))[:80]}")
            if check_fn:
                fn_errors = check_fn(f, names)
                errors.extend(fn_errors)
    return errors


def require_run_method(f: Path, names: list[str]) -> list[str]:
    if "run" not in names and f.stem not in ("base", "registry"):
        return [f"  ✗ {f.name}: Missing run() method"]
    return []


def main(base: str = ".") -> int:
    root = Path(base)
    api = root / "apps/api/app"
    errors = []

    errors += check_dir("Schemas",  api / "schemas")
    errors += check_dir("Routes",   api / "routes")
    errors += check_dir("Services", api / "services")
    errors += check_dir("Agents",   api / "agents", check_fn=require_run_method)

    print(f"\n{'='*40}")
    if errors:
        print(f"❌ {len(errors)} issue(s) found:")
        for e in errors:
            print(f"  {e}")
        return 1
    else:
        print("✅ All checks passed!")
        return 0


if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "."
    sys.exit(main(base))
