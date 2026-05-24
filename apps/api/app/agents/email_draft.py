from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class EmailDraftAgent(BaseAgent):
    id = "email_draft_agent"
    name = "Email Draft Agent"
    agent_type = "email_draft"
    description = "Drafts emails, summarizes threads, recommends reply tone. Never sends without approval."
    risk_level = "high"
    requires_approval_for = ["send_email"]

    async def run(self, input_data: dict, db: Session) -> dict:
        subject = input_data.get("subject", "")
        recipient = input_data.get("recipient", "")
        context = input_data.get("context", "")
        thread_summary = input_data.get("thread_summary", "")
        tone = input_data.get("tone", "professional")

        prompt = f"""Draft an email for this context:
Subject: {subject}
Recipient: {recipient}
Context: {context}
Thread/history: {thread_summary}
Requested tone: {tone}

Return JSON only:
{{
  "subject": "email subject line",
  "to": "recipient",
  "tone": "professional|friendly|formal|casual",
  "draft_body": "full email body",
  "key_points_covered": ["point 1", "point 2"],
  "requires_review": true,
  "suggested_send_time": null
}}

IMPORTANT: This is a DRAFT ONLY. Mark requires_review as true always."""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "subject": subject or "Re: [subject]",
                "to": recipient,
                "tone": tone,
                "draft_body": f"Hi,\n\n[Draft response about: {context}]\n\nBest regards",
                "key_points_covered": [],
                "requires_review": True,
                "suggested_send_time": None
            }
        result["requires_review"] = True
        return result
