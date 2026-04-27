from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime

VALID_QUADRANTS = ("q1", "q2", "q3", "q4")
VALID_STATUSES = ("pending", "completed", "archived")
VALID_PUSH_TYPES = ("email", "webhook")


class RegisterRequest(BaseModel):
    username: str = Field(max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str = Field(max_length=200)
    description: Optional[str] = Field(default="", max_length=2000)
    quadrant: Optional[str] = None

    @field_validator("quadrant")
    @classmethod
    def validate_quadrant(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_QUADRANTS:
            raise ValueError(f"quadrant must be one of: {', '.join(VALID_QUADRANTS)}")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    quadrant: Optional[str] = None
    status: Optional[str] = None

    @field_validator("quadrant")
    @classmethod
    def validate_quadrant(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_QUADRANTS:
            raise ValueError(f"quadrant must be one of: {', '.join(VALID_QUADRANTS)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str
    quadrant: str
    status: str
    is_long_term: bool
    ai_metadata: dict
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    code: int = 200
    data: Optional[object] = None
    message: str = "ok"


# ======================================================================
# Push Config
# ======================================================================

class PushConfigCreate(BaseModel):
    push_type: str = Field(max_length=20)
    address: str = Field(max_length=255)
    push_time: str = Field(default="09:00", max_length=10)

    @field_validator("push_type")
    @classmethod
    def validate_push_type(cls, v: str) -> str:
        if v not in VALID_PUSH_TYPES:
            raise ValueError(f"push_type must be one of: {', '.join(VALID_PUSH_TYPES)}")
        return v


class PushConfigUpdate(BaseModel):
    push_type: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=255)
    push_time: Optional[str] = Field(default=None, max_length=10)
    enabled: Optional[bool] = None

    @field_validator("push_type")
    @classmethod
    def validate_push_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PUSH_TYPES:
            raise ValueError(f"push_type must be one of: {', '.join(VALID_PUSH_TYPES)}")
        return v


class PushConfigResponse(BaseModel):
    id: int
    user_id: int
    push_type: str
    address: str
    push_time: str
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ======================================================================
# Push Log
# ======================================================================

class PushLogResponse(BaseModel):
    id: int
    user_id: int
    push_config_id: Optional[int] = None
    summary_content: str
    status: str
    error_message: str
    created_at: datetime

    class Config:
        from_attributes = True


# ======================================================================
# Batch Reclassification
# ======================================================================

class BatchReclassifyItem(BaseModel):
    id: int
    title: str
    old_quadrant: str
    new_quadrant: str
    reason: str


# ======================================================================
# Statistics
# ======================================================================

class StatsQuadrant(BaseModel):
    q1: int = 0
    q2: int = 0
    q3: int = 0
    q4: int = 0


class StatsCompletion(BaseModel):
    total: int = 0
    completed: int = 0
    pending: int = 0
    rate: float = 0.0


class StatsTrendItem(BaseModel):
    date: str
    count: int


# ======================================================================
# Quick Note (小记)
# ======================================================================

class NoteProcessRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class NoteTaskItem(BaseModel):
    title: str
    description: str = ""
    quadrant: str
    reason: str = ""


class NoteProcessResponse(BaseModel):
    tasks: list[NoteTaskItem] = []


class NoteConfirmRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    tasks: list[NoteTaskItem]
