from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OAuthToken
from app.services.ollama_client import OllamaClient

GMAIL_PROVIDER = "gmail"


class GmailNotConnectedError(Exception):
    pass


class GmailService:
    def __init__(self) -> None:
        secret = os.getenv("TOKEN_ENCRYPTION_KEY")
        if not secret:
            secret = Fernet.generate_key().decode()
        self.fernet = Fernet(secret.encode())
        self.client_id = os.getenv("GMAIL_CLIENT_ID", "")
        self.redirect_uri = os.getenv("GMAIL_REDIRECT_URI", "http://localhost:8000/gmail/oauth/callback")

    def get_auth_url(self) -> str:
        scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose"
        return (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={self.client_id}&redirect_uri={self.redirect_uri}&response_type=code&scope={scope}&access_type=offline&prompt=consent"
        )

    def store_tokens(self, db: Session, access_token: str, refresh_token: str | None, token_type: str | None, expires_at: str | None) -> None:
        current = db.scalar(select(OAuthToken).where(OAuthToken.provider == GMAIL_PROVIDER))
        enc_access = self.fernet.encrypt(access_token.encode()).decode()
        enc_refresh = self.fernet.encrypt(refresh_token.encode()).decode() if refresh_token else None
        if current:
            current.access_token_encrypted = enc_access
            current.refresh_token_encrypted = enc_refresh
            current.token_type = token_type
            current.expires_at = expires_at
            db.add(current)
        else:
            db.add(OAuthToken(provider=GMAIL_PROVIDER, access_token_encrypted=enc_access, refresh_token_encrypted=enc_refresh, token_type=token_type, expires_at=expires_at))
        db.commit()

    def disconnect(self, db: Session) -> None:
        current = db.scalar(select(OAuthToken).where(OAuthToken.provider == GMAIL_PROVIDER))
        if current:
            db.delete(current)
            db.commit()

    def _get_access_token(self, db: Session) -> str:
        current = db.scalar(select(OAuthToken).where(OAuthToken.provider == GMAIL_PROVIDER))
        if not current:
            raise GmailNotConnectedError("Gmail is not connected")
        return self.fernet.decrypt(current.access_token_encrypted.encode()).decode()

    async def recent_emails(self, db: Session, max_results: int = 10) -> list[dict[str, str]]:
        token = self._get_access_token(db)
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=20) as client:
            msg_res = await client.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", headers=headers, params={"maxResults": max_results})
            msg_res.raise_for_status()
            ids = msg_res.json().get("messages", [])
            emails: list[dict[str, str]] = []
            for item in ids:
                mid = item.get("id")
                if not mid:
                    continue
                one = await client.get(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}", headers=headers, params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]})
                one.raise_for_status()
                payload = one.json().get("payload", {})
                headers_data = {h["name"]: h["value"] for h in payload.get("headers", []) if "name" in h and "value" in h}
                snippet = one.json().get("snippet", "")
                emails.append({"id": mid, "subject": headers_data.get("Subject", "(no subject)"), "from": headers_data.get("From", ""), "date": headers_data.get("Date", ""), "snippet": snippet, "source_link": f"https://mail.google.com/mail/u/0/#inbox/{mid}"})
            return emails

    async def extract_actions(self, email_text: str) -> dict[str, list[str]]:
        prompt = Path(__file__).resolve().parent.parent / "prompts" / "email_extraction_v1.txt"
        template = prompt.read_text(encoding="utf-8")
        payload = {"email_text": email_text, "generated_at": datetime.now(timezone.utc).isoformat()}
        client = OllamaClient()
        result = await client.generate_daily_brief({"prompt_override": template, **payload})
        return {
            "action_items": result.get("top_priorities", []),
            "due_dates": result.get("suggested_schedule", []),
            "people": result.get("follow_ups", []),
            "follow_ups": result.get("recommended_deferrals", []),
        }

    async def draft_reply(self, email_text: str, goal: str) -> dict[str, str]:
        prompt = Path(__file__).resolve().parent.parent / "prompts" / "email_draft_v1.txt"
        template = prompt.read_text(encoding="utf-8")
        client = OllamaClient()
        out = await client.generate_daily_brief({"prompt_override": template, "email_text": email_text, "goal": goal})
        return {"subject": (out.get("top_priorities") or ["Draft reply"])[0], "body": "\n".join(out.get("suggested_schedule", [])), "tone": "professional"}
