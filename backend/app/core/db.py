from sqlmodel import Session, create_engine, select
from sqlalchemy import event

from app import crud
from app.core.config import settings
from app.models import User, UserCreate

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    # FastAPI runs requests in a thread pool; SQLite connections refuse that
    # by default
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):  # type: ignore[no-untyped-def]
    cursor = dbapi_conn.cursor()
    # SQLite ignores foreign keys (and ON DELETE CASCADE) unless enabled
    cursor.execute("PRAGMA foreign_keys=ON")
    # readers don't block the writer
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)
