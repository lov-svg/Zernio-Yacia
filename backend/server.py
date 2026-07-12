import os
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

import db
import refresh_service
import ideas_service

app = FastAPI()
api = APIRouter(prefix="/api")

ACCOUNT_ID = os.environ["ZERNIO_ACCOUNT_ID"]
TZ = os.environ.get("DASHBOARD_TZ", "America/Mexico_City")


class DiscardBody(BaseModel):
    reason_quick: str = ""
    reason_text: str = ""


class GenerateBody(BaseModel):
    bucket: str | None = None


def _rows(conn, sql, **params):
    return [dict(r) for r in conn.execute(text(sql), params).mappings().all()]


@api.get("/")
def root():
    return {"message": "Dashboard Instagram API"}


@api.get("/dashboard/account")
def get_account():
    with db.get_engine().connect() as conn:
        snap = _rows(conn, "SELECT * FROM account_snapshot WHERE platform = 'instagram'")
        health = _rows(conn, "SELECT * FROM account_health WHERE platform = 'instagram'")
        last = _rows(conn, "SELECT * FROM refresh_log WHERE status = 'ok' ORDER BY id DESC LIMIT 1")
    return {
        "snapshot": snap[0] if snap else None,
        "health": health[0] if health else None,
        "last_refresh": last[0] if last else None,
    }


@api.post("/dashboard/refresh")
def refresh():
    try:
        return refresh_service.run_refresh(ACCOUNT_ID)
    except Exception as e:
        logging.exception("refresh failed")
        raise HTTPException(status_code=500, detail=str(e)[:300])


@api.get("/dashboard/overview")
def overview():
    with db.get_engine().connect() as conn:
        insights = _rows(conn, "SELECT * FROM account_insights_30d")
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
        agg = _rows(conn, """
            SELECT COALESCE(SUM(likes),0) likes, COALESCE(SUM(comments),0) comments,
                   COALESCE(SUM(saves),0) saves, COALESCE(SUM(shares),0) shares,
                   COALESCE(SUM(post_count),0) posts
            FROM daily_metrics WHERE date >= :c""", c=cutoff)
        fh = _rows(conn, "SELECT * FROM follower_history ORDER BY date DESC LIMIT 1")
    return {"insights": insights, "last30": agg[0] if agg else {}, "followers": fh[0] if fh else None}


@api.get("/dashboard/trend")
def trend(days: int = 90):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    with db.get_engine().connect() as conn:
        rows = _rows(conn, "SELECT * FROM daily_metrics WHERE date >= :c ORDER BY date", c=cutoff)
        fh = _rows(conn, "SELECT * FROM follower_history ORDER BY date")
    return {"daily": rows, "follower_history": fh}


@api.get("/dashboard/demographics")
def demographics():
    with db.get_engine().connect() as conn:
        rows = _rows(conn, "SELECT * FROM demographics ORDER BY value DESC")
    out = {}
    for r in rows:
        out.setdefault(r["dimension_type"], []).append({"bucket": r["bucket"], "value": r["value"]})
    return out


@api.get("/dashboard/posts")
def posts(sort: str = "engagement"):
    order = {
        "engagement": "(like_count + comment_count*3) DESC",
        "likes": "like_count DESC",
        "comments": "comment_count DESC",
        "recent": "created_time DESC",
    }.get(sort, "(like_count + comment_count*3) DESC")
    with db.get_engine().connect() as conn:
        rows = _rows(conn, f"SELECT * FROM posts ORDER BY {order}")
    return {"posts": rows}


@api.get("/dashboard/posts/{post_id}/comments")
def post_comments(post_id: str):
    with db.get_engine().connect() as conn:
        rows = _rows(conn, "SELECT * FROM comments WHERE post_id = :p ORDER BY like_count DESC", p=post_id)
    return {"comments": rows}


@api.get("/dashboard/best-time")
def best_time():
    offset_h = int(datetime.now(ZoneInfo(TZ)).utcoffset().total_seconds() // 3600)
    with db.get_engine().connect() as conn:
        rows = _rows(conn, "SELECT * FROM best_time")
    slots = []
    for r in rows:
        local_hour = (r["hour"] + offset_h) % 24
        day_shift = (r["hour"] + offset_h) // 24
        slots.append({
            "day_of_week": (r["day_of_week"] + day_shift) % 7,
            "hour": local_hour,
            "avg_engagement": r["avg_engagement"],
            "post_count": r["post_count"],
        })
    return {"slots": slots, "timezone": TZ}


@api.get("/dashboard/frequency")
def frequency():
    with db.get_engine().connect() as conn:
        freq = _rows(conn, "SELECT * FROM posting_frequency ORDER BY posts_per_week")
        decay = _rows(conn, "SELECT * FROM content_decay ORDER BY bucket_order")
    return {"frequency": freq, "decay": decay}


@api.get("/ideas")
def list_ideas():
    with db.get_engine().connect() as conn:
        rows = _rows(conn, "SELECT * FROM ideas WHERE discarded = 0 ORDER BY id DESC")
        discards = _rows(conn, """
            SELECT d.*, i.format FROM idea_discards d LEFT JOIN ideas i ON i.id = d.idea_id
            ORDER BY d.id DESC LIMIT 10""")
        posts_map = {r["id"]: r for r in
                     conn.execute(text("SELECT id, permalink, caption FROM posts")).mappings().all()}
    for r in rows:
        for f in ("evidence_quotes", "basis_post_ids", "basis_comment_ids", "basis_message_ids"):
            r[f] = json.loads(r[f] or "[]")
        r["related_posts"] = [
            {"id": pid, "permalink": posts_map[pid]["permalink"], "caption": (posts_map[pid]["caption"] or "")[:80]}
            for pid in r["basis_post_ids"] if pid in posts_map
        ]
    buckets = {"comments": [], "dms": [], "top_content": []}
    for r in rows:
        buckets.setdefault(r["source_bucket"], []).append(r)
    return {"buckets": buckets, "recent_discards": discards}


@api.post("/ideas/generate")
def generate(body: GenerateBody):
    if body.bucket and body.bucket not in ("comments", "dms", "top_content"):
        raise HTTPException(status_code=400, detail="bucket inválido")
    try:
        return ideas_service.generate_ideas(body.bucket)
    except Exception as e:
        logging.exception("ideas generation failed")
        raise HTTPException(status_code=500, detail=str(e)[:300])


@api.post("/ideas/{idea_id}/discard")
def discard(idea_id: int, body: DiscardBody):
    with db.get_engine().begin() as conn:
        row = conn.execute(text("SELECT * FROM ideas WHERE id = :i"), {"i": idea_id}).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Idea no encontrada")
        conn.execute(db.idea_discards.insert().values(
            idea_id=idea_id, angle=row["angle"], source_bucket=row["source_bucket"],
            discarded_at=datetime.now(timezone.utc).isoformat(),
            reason_quick=body.reason_quick, reason_text=body.reason_text))
        conn.execute(text("UPDATE ideas SET discarded = 1 WHERE id = :i"), {"i": idea_id})
    return {"status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
