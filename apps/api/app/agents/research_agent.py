from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class ResearchAgent(BaseAgent):
    id = "research_agent"
    name = "Research Agent"
    agent_type = "research"
    description = "Gathers and synthesizes information from provided context to answer questions"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        query = input_data.get("query", "")
        context = input_data.get("context", "")
        sources = input_data.get("sources", [])
        sources_text = "\n".join(sources) if sources else "None provided"

        prompt = f"""Answer the following query using only the provided context and sources.

Query: {query}
Background context: {context}
Sources:
{sources_text}

Return JSON only:
{{
  "answer": "direct answer to the query based on provided context",
  "confidence": 0.0,
  "sources_used": ["source excerpt or label used"],
  "knowledge_gaps": ["gap 1", "gap 2"],
  "follow_up_questions": ["question 1", "question 2"],
  "recommended_actions": ["action 1", "action 2"],
  "requires_more_context": false
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "answer": "Insufficient context to research this query",
                "confidence": 0.0,
                "sources_used": [],
                "knowledge_gaps": ["More context needed"],
                "follow_up_questions": [],
                "recommended_actions": [],
                "requires_more_context": True
            }
        return result
