from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    model: str = "claude-opus-4-7"
    jarvis_api_url: str = "http://localhost:8000"
    repo_root: str = "."
    log_token_usage: bool = True

    class Config:
        env_file = ".env"
        env_prefix = "CLAUDE_AGENT_"


settings = Settings()
