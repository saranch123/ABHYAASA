from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/abhyaasa"
    secret_key: str = "change-me-to-a-random-256-bit-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    dev_mode: bool = True
    use_in_memory_fallback: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
