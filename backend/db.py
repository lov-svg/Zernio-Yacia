import os
from sqlalchemy import (create_engine, MetaData, Table, Column, Text, Integer,
                        Float, text)
from sqlalchemy.pool import NullPool

_engine = None
metadata = MetaData()

account_snapshot = Table(
    "account_snapshot", metadata,
    Column("platform", Text, primary_key=True),
    Column("username", Text), Column("display_name", Text),
    Column("profile_picture", Text), Column("profile_url", Text),
    Column("followers_count", Integer), Column("bio", Text),
    Column("media_count", Integer), Column("fetched_at", Text),
)

account_health = Table(
    "account_health", metadata,
    Column("platform", Text, primary_key=True),
    Column("status", Text), Column("token_valid", Integer),
    Column("token_expires_at", Text), Column("can_fetch_analytics", Integer),
    Column("fetched_at", Text),
)

account_insights_30d = Table(
    "account_insights_30d", metadata,
    Column("metric", Text, primary_key=True),
    Column("value", Float), Column("since_date", Text),
    Column("until_date", Text), Column("fetched_at", Text),
)

daily_metrics = Table(
    "daily_metrics", metadata,
    Column("date", Text, primary_key=True),
    Column("impressions", Integer), Column("reach", Integer),
    Column("likes", Integer), Column("comments", Integer),
    Column("shares", Integer), Column("saves", Integer),
    Column("views", Integer), Column("post_count", Integer),
)

demographics = Table(
    "demographics", metadata,
    Column("dimension_type", Text, primary_key=True),
    Column("bucket", Text, primary_key=True),
    Column("value", Integer),
)

posts = Table(
    "posts", metadata,
    Column("id", Text, primary_key=True),
    Column("caption", Text), Column("created_time", Text),
    Column("permalink", Text), Column("picture", Text),
    Column("like_count", Integer), Column("comment_count", Integer),
)

comments = Table(
    "comments", metadata,
    Column("id", Text, primary_key=True),
    Column("post_id", Text), Column("username", Text),
    Column("text", Text), Column("created_time", Text),
    Column("like_count", Integer),
)

conversations = Table(
    "conversations", metadata,
    Column("id", Text, primary_key=True),
    Column("participant_name", Text), Column("participant_username", Text),
    Column("last_message", Text), Column("updated_time", Text),
)

messages = Table(
    "messages", metadata,
    Column("id", Text, primary_key=True),
    Column("conversation_id", Text), Column("text", Text),
    Column("direction", Text), Column("sender_name", Text),
    Column("created_at", Text),
)

best_time = Table(
    "best_time", metadata,
    Column("day_of_week", Integer, primary_key=True),
    Column("hour", Integer, primary_key=True),
    Column("avg_engagement", Float), Column("post_count", Integer),
)

posting_frequency = Table(
    "posting_frequency", metadata,
    Column("posts_per_week", Integer, primary_key=True),
    Column("avg_engagement_rate", Float), Column("avg_engagement", Float),
    Column("weeks_count", Integer),
)

content_decay = Table(
    "content_decay", metadata,
    Column("bucket_order", Integer, primary_key=True),
    Column("bucket_label", Text), Column("avg_pct_of_final", Float),
    Column("post_count", Integer),
)

follower_history = Table(
    "follower_history", metadata,
    Column("date", Text, primary_key=True),
    Column("follower_count", Integer),
    Column("followers_gained", Integer), Column("followers_lost", Integer),
)

ideas = Table(
    "ideas", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("generated_at", Text), Column("batch_id", Text),
    Column("source_bucket", Text, nullable=False, server_default="top_content"),
    Column("angle", Text), Column("format", Text),
    Column("rationale", Text),
    Column("evidence_quotes", Text), Column("why_good_idea", Text),
    Column("suggested_angle", Text),
    Column("basis_post_ids", Text), Column("basis_comment_ids", Text),
    Column("basis_message_ids", Text),
    Column("discarded", Integer, server_default="0"),
)

idea_discards = Table(
    "idea_discards", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("idea_id", Integer), Column("angle", Text),
    Column("source_bucket", Text), Column("discarded_at", Text),
    Column("reason_quick", Text), Column("reason_text", Text),
)

refresh_log = Table(
    "refresh_log", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("started_at", Text), Column("finished_at", Text),
    Column("status", Text), Column("detail", Text),
)


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
        metadata.create_all(_engine)
    return _engine


def upsert(conn, table, row, pk_cols):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = pg_insert(table).values(**row)
    update_cols = {c: stmt.excluded[c] for c in row if c not in pk_cols}
    if update_cols:
        stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
    conn.execute(stmt)
