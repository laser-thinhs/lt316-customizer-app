from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = ""
    api_auth_required: bool = False
    api_auth_required_in_test: bool = False
    api_key: str = ""
    env: str = "development"

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()


def is_auth_required() -> bool:
    if not settings.api_auth_required:
        return False

    if settings.env == "test" and not settings.api_auth_required_in_test:
        return False

    return True
