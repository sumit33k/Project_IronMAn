from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_timeout: int = 60
    ollama_temperature: float = 0.7
    database_url: str = "sqlite:///./ironman.db"
    debug: bool = True
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/integrations/google/callback"

    class Config:
        env_file = ".env"


settings = Settings()
