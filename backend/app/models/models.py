from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class Quadrant(str, enum.Enum):
    Q1 = "q1"  # Urgent & Important
    Q2 = "q2"  # Not Urgent & Important
    Q3 = "q3"  # Urgent & Not Important
    Q4 = "q4"  # Not Urgent & Not Important


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    quadrant = Column(Enum(Quadrant), default=Quadrant.Q4)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_long_term = Column(Integer, default=0)
    ai_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PushConfig(Base):
    __tablename__ = "push_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    push_type = Column(String(20), nullable=False)  # "email" or "webhook"
    address = Column(String(255), nullable=False)
    push_time = Column(String(10), default="09:00")
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PushLog(Base):
    __tablename__ = "push_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    push_config_id = Column(Integer, ForeignKey("push_configs.id"), nullable=True)
    summary_content = Column(Text, default="")
    status = Column(String(20), default="success")  # "success" or "failed"
    error_message = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
