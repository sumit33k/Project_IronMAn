"""voice_sessions_and_provider_config

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'voice_sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='created'),
        sa.Column('stt_provider', sa.String(64), nullable=False, server_default='browser'),
        sa.Column('tts_provider', sa.String(64), nullable=False, server_default='browser'),
        sa.Column('transport_provider', sa.String(64), nullable=False, server_default='browser'),
        sa.Column('turn_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('command_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'voice_turns',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('turn_number', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('role', sa.String(16), nullable=False, server_default='user'),
        sa.Column('transcript', sa.Text(), nullable=True),
        sa.Column('partial_transcript', sa.Text(), nullable=True),
        sa.Column('command_id', sa.String(36), nullable=True),
        sa.Column('stt_latency_ms', sa.Integer(), nullable=True),
        sa.Column('llm_latency_ms', sa.Integer(), nullable=True),
        sa.Column('tts_latency_ms', sa.Integer(), nullable=True),
        sa.Column('total_latency_ms', sa.Integer(), nullable=True),
        sa.Column('interrupted', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['voice_sessions.id']),
        sa.ForeignKeyConstraint(['command_id'], ['commands.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('voice_turns')
    op.drop_table('voice_sessions')
