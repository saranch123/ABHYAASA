from pydantic import BaseModel


class DevLoginRequest(BaseModel):
    alias: str  # e.g. "dev_user_1"
    language: str = "en"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    alias: str
