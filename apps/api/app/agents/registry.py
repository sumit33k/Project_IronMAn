from typing import Optional
from app.agents.base import BaseAgent


class AgentRegistry:
    _agents: dict[str, BaseAgent] = {}

    @classmethod
    def register(cls, agent: BaseAgent):
        cls._agents[agent.id] = agent

    @classmethod
    def get(cls, agent_id: str) -> Optional[BaseAgent]:
        return cls._agents.get(agent_id)

    @classmethod
    def all_agents(cls) -> list[BaseAgent]:
        return list(cls._agents.values())

    @classmethod
    def get_by_type(cls, agent_type: str) -> Optional[BaseAgent]:
        return next((a for a in cls._agents.values() if a.agent_type == agent_type), None)


_registry = AgentRegistry()


def get_registry() -> AgentRegistry:
    return _registry
