from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class PresentationAgent(BaseAgent):
    id = "presentation_agent"
    name = "Presentation Agent"
    agent_type = "presentation"
    description = "Creates presentation outlines, slide structures, and content plans"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        topic = input_data.get("topic", input_data.get("title", "presentation"))
        context = input_data.get("context", "")

        prompt = f"""Create a presentation outline for: "{topic}"
Additional context: {context}

Return JSON only:
{{
  "title": "presentation title",
  "objective": "what this presentation achieves",
  "audience": "target audience",
  "duration_minutes": 30,
  "slides": [
    {{
      "slide_number": 1,
      "title": "slide title",
      "type": "title|content|data|summary",
      "key_points": ["point 1", "point 2"],
      "notes": "speaker notes or data needed"
    }}
  ],
  "data_needed": ["data point 1", "data point 2"],
  "next_steps": ["action 1", "action 2"]
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "title": f"Presentation: {topic}",
                "objective": "To be defined",
                "audience": "To be defined",
                "duration_minutes": 30,
                "slides": [
                    {"slide_number": 1, "title": "Introduction", "type": "title", "key_points": [topic], "notes": ""},
                    {"slide_number": 2, "title": "Overview", "type": "content", "key_points": [], "notes": ""},
                    {"slide_number": 3, "title": "Key Points", "type": "content", "key_points": [], "notes": ""},
                    {"slide_number": 4, "title": "Next Steps", "type": "summary", "key_points": [], "notes": ""},
                ],
                "data_needed": [],
                "next_steps": []
            }
        return result
