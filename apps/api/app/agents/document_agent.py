from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class DocumentAgent(BaseAgent):
    id = "document_agent"
    name = "Document Agent"
    agent_type = "document_summarizer"
    description = "Summarizes documents and extracts actionable tasks from text content"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        content = input_data.get("content", "")
        filename = input_data.get("filename", "")
        context = input_data.get("context", "")
        word_count = len(content.split())

        prompt = f"""Analyze the following document and extract structured information.

Filename: {filename}
Context: {context}
Document content:
{content}

Return JSON only:
{{
  "summary": "concise summary of the document",
  "key_points": ["key point 1", "key point 2"],
  "extracted_tasks": [
    {{
      "title": "task title",
      "priority": "low|medium|high|critical",
      "due_date": null,
      "category": "office|personal|finance|health|errands|project"
    }}
  ],
  "decisions_needed": ["decision 1", "decision 2"],
  "confidence_score": 0.0
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "summary": "Unable to process document",
                "key_points": [],
                "extracted_tasks": [],
                "decisions_needed": [],
                "word_count": word_count,
                "confidence_score": 0.0
            }
        result["word_count"] = word_count
        return result
