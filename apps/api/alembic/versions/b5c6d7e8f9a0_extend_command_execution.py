"""extend_command_execution

Revision ID: b5c6d7e8f9a0
Revises: a3b7c2d1e4f5
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'a3b7c2d1e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('commands', sa.Column('action_type', sa.String(128), nullable=True))
    op.add_column('commands', sa.Column('target_resource_type', sa.String(64), nullable=True))
    op.add_column('commands', sa.Column('target_resource_id', sa.String(36), nullable=True))
    op.add_column('commands', sa.Column('execution_result', sa.Text(), nullable=True))
    op.add_column('commands', sa.Column('error_message', sa.Text(), nullable=True))
    op.add_column('commands', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('commands', sa.Column('confirmation_method', sa.String(32), nullable=True))
    op.add_column('commands', sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('commands', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('commands', sa.Column('voice_session_id', sa.String(36), nullable=True))
    op.add_column('commands', sa.Column('transcript_id', sa.String(36), nullable=True))
    op.add_column('commands', sa.Column('latency_ms', sa.Integer(), nullable=True))
    op.add_column('commands', sa.Column('provider_trace', sa.Text(), nullable=True))


def downgrade() -> None:
    for col in [
        'provider_trace', 'latency_ms', 'transcript_id', 'voice_session_id',
        'completed_at', 'executed_at', 'confirmation_method', 'confirmed_at',
        'error_message', 'execution_result', 'target_resource_id',
        'target_resource_type', 'action_type',
    ]:
        op.drop_column('commands', col)
