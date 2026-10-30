"""Add patient, clinicalrecord and prescription tables

Revision ID: a7c1d2e3f4b5
Revises: fe56fa70289e
Create Date: 2026-10-26 09:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "a7c1d2e3f4b5"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "patient",
        sa.Column("first_name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("last_name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("gender", sa.String(length=10), nullable=True),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("blood_group", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=True),
        sa.Column("photo_url", sqlmodel.sql.sqltypes.AutoString(length=2048), nullable=True),
        sa.Column("recent_diagnosis", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column("chronic_conditions", sa.JSON(), nullable=True),
        sa.Column("physician_name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("last_visit", sa.Date(), nullable=True),
        sa.Column("has_alert", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("alert_message", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "clinicalrecord",
        sa.Column("emr_number", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column("visit_date", sa.DateTime(), nullable=False),
        sa.Column("physician_name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("visit_type", sa.String(length=20), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("diagnosis", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patient.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clinicalrecord_patient_id"), "clinicalrecord", ["patient_id"])
    op.create_table(
        "prescription",
        sa.Column("medication", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("dosage", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("frequency", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("prescribed_by", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("prescribed_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("allergy_checked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patient.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_prescription_patient_id"), "prescription", ["patient_id"])


def downgrade():
    op.drop_index(op.f("ix_prescription_patient_id"), table_name="prescription")
    op.drop_table("prescription")
    op.drop_index(op.f("ix_clinicalrecord_patient_id"), table_name="clinicalrecord")
    op.drop_table("clinicalrecord")
    op.drop_table("patient")
