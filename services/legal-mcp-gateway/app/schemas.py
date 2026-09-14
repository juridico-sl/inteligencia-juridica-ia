from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re


class ProcessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    process_number: str
    court: str | None = Field(default=None, max_length=12)

    @field_validator("process_number")
    @classmethod
    def normalize_cnj(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) != 20:
            raise ValueError("Número CNJ deve conter 20 dígitos")
        return digits

    @field_validator("court")
    @classmethod
    def normalize_court(cls, value: str | None) -> str | None:
        return value.upper() if value else None


class MovementRequest(ProcessRequest):
    court: str = Field(min_length=2, max_length=12)
    limit: int = Field(default=50, ge=1, le=50)


class MonitorRequest(ProcessRequest):
    court: str = Field(min_length=2, max_length=12)
    since: datetime


class DeadlineRequest(ProcessRequest):
    court: str = Field(min_length=2, max_length=12)
    act_type: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    service_date: datetime | None = None


class MovementAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    summary: str = Field(min_length=1, max_length=500)
    relevance: Literal["info", "informative", "attention", "urgent"]
    possible_deadline: bool
    deadline_date: datetime | None = None
    reason: str = Field(min_length=1, max_length=1000)
    suggested_action: str = Field(min_length=1, max_length=500)
