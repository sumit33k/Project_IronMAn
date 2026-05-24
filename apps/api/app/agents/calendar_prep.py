from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class CalendarPrepAgent(BaseAgent):
    id = "calendar_prep_agent"
    name = "Calendar Prep Agent"
    agent_type = "calendar_prep"
    description = "Preps for meetings with checklists and summaries. Never moves events without approval."
    risk_level = "medium"
    requires_approval_for = ["move_event", "create_invite", "cancel_event"]

    async def run(self, input_data: dict, db: Session) -> dict:
        meeting_title = input_data.get("meeting_title", input_data.get("title", "meeting"))
        attendees = input_data.get("attendees", [])
        agenda = input_data.get("agenda", "")

        prompt = f"""Prepare for this meeting:
Title: {meeting_title}
Attendees: {", ".join(attendees) if attendees else "TBD"}
Agenda: {agenda}

Return JSON:
{{
  "meeting_title": "title",
  "prep_checklist": ["item 1", "item 2"],
  "key_questions": ["question 1"],
  "materials_needed": ["material 1"],
  "pre_meeting_tasks": ["task 1"],
  "suggested_agenda": ["agenda item 1"],
  "follow_up_template": "post-meeting follow-up template"
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "meeting_title": meeting_title,
                "prep_checklist": ["Review agenda", "Prepare materials", "Confirm attendance"],
                "key_questions": [],
                "materials_needed": [],
                "pre_meeting_tasks": [],
                "suggested_agenda": [],
                "follow_up_template": "Meeting recap and next steps"
            }
        return result
