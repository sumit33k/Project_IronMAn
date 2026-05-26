"""add_notes_projects_routines

Revision ID: a3b7c2d1e4f5
Revises: 015f444cc0ad
Create Date: 2026-05-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b7c2d1e4f5'
down_revision: Union[str, None] = '015f444cc0ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create projects table first (tasks.project_id FKs to it)
    op.create_table(
        'projects',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('color', sa.String(length=16), nullable=False),
        sa.Column('due_date', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Add project_id FK column to tasks
    op.add_column(
        'tasks',
        sa.Column('project_id', sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        'fk_tasks_project_id',
        'tasks', 'projects',
        ['project_id'], ['id'],
    )

    # Create notes table (linked_task_id FKs to tasks)
    op.create_table(
        'notes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('linked_task_id', sa.String(length=36), nullable=True),
        sa.Column('tags', sa.Text(), nullable=False),
        sa.Column('pinned', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['linked_task_id'], ['tasks.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create routines table
    op.create_table(
        'routines',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('frequency', sa.String(length=32), nullable=False),
        sa.Column('target_time', sa.String(length=8), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('streak', sa.Integer(), nullable=False),
        sa.Column('last_completed', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('routines')
    op.drop_table('notes')
    op.drop_constraint('fk_tasks_project_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'project_id')
    op.drop_table('projects')
