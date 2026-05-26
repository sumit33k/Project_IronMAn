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
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    # Set to true to allow any origin (needed when the UI is deployed remotely)
    cors_allow_all_origins: bool = False
    # Groq API key for Whisper-based speech-to-text (optional, leave empty to use browser STT)
    groq_api_key: str = ""
    # Ollama max tokens per generation (0 = model default, lower = faster/cheaper responses)
    ollama_max_tokens: int = 0

    class Config:
        env_file = ".env"


settings = Settings()
