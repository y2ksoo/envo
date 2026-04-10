from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    database_url: str = "sqlite:///./data/envo.db"
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10
    daily_review_limit: int = 20

    class Config:
        env_file = ".env"


settings = Settings()
