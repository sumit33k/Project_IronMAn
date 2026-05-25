from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class CallAgent(BaseAgent):
    id = "call_agent"
    name = "Call Agent"
    agent_type = "call_prep"
    description = "Prepares talking points, call checklists, and follow-up templates for meetings and calls"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        meeting_title = input_data.get("meeting_title", "")
        attendees = input_data.get("attendees", [])
        agenda = input_data.get("agenda", "")
        context = input_data.get("context", "")
        call_type = input_data.get("call_type", "internal")

        prompt = f"""Prepare a structured call preparation package for the following meeting.

Meeting Title: "{meeting_title}"
Call Type: {call_type}
Attendees: {attendees}
Agenda: {agenda}
Context: {context}

Return JSON only:
{{
  "call_title": "clean meeting title",
  "call_type": "{call_type}",
  "prep_checklist": ["list of preparation items to complete before the call"],
  "talking_points": ["3-7 key talking points to cover"],
  "questions_to_ask": ["questions to ask the other party"],
  "topics_to_handle_carefully": ["sensitive or tricky topics and how to handle them"],
  "follow_up_template": "email/message template to send after the call",
  "suggested_duration_minutes": 30,
  "key_outcomes_to_achieve": ["desired outcomes from this call"],
  "materials_to_prepare": ["documents, slides, or resources to have ready"]
}}"""

        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "call_title": meeting_title,
                "call_type": call_type,
                "prep_checklist": ["Review agenda", "Test audio/video", "Prepare notes"],
                "talking_points": ["Introduction", "Main agenda items", "Next steps"],
                "questions_to_ask": ["What are the expected outcomes?"],
                "topics_to_handle_carefully": [],
                "follow_up_template": f"Hi,\n\nThank you for the call regarding {meeting_title}. Here are the key takeaways and next steps:\n\n[Summary]\n\nNext steps:\n- \n\nBest regards",
                "suggested_duration_minutes": 30,
                "key_outcomes_to_achieve": ["Alignment on next steps"],
                "materials_to_prepare": ["Agenda", "Relevant documents"],
            }
        return result
