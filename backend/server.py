import os
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
from io import BytesIO

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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


@api.get("/profile-picture")
def profile_picture():
    """Proxy profile picture from Instagram to bypass CORS"""
    with db.get_engine().connect() as conn:
        snap = _rows(conn, "SELECT profile_picture FROM account_snapshot WHERE platform = 'instagram'")
    pic_url = snap[0].get("profile_picture") if snap else None
    if not pic_url:
        raise HTTPException(status_code=404, detail="Profile picture not found")
    try:
        resp = requests.get(pic_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        return StreamingResponse(BytesIO(resp.content), media_type=resp.headers.get("content-type", "image/jpeg"), headers={"Cache-Control": "public, max-age=3600"})
    except Exception as e:
        logging.exception("failed to proxy profile picture")
        raise HTTPException(status_code=500, detail=str(e))


@api.get("/dashboard/account")
def get_account():
    with db.get_engine().connect() as conn:
        snap = _rows(conn, "SELECT * FROM account_snapshot WHERE platform = 'instagram'")
        health = _rows(conn, "SELECT * FROM account_health WHERE platform = 'instagram'")
        last = _rows(conn, "SELECT * FROM refresh_log WHERE status = 'ok' ORDER BY id DESC LIMIT 1")
    # Regenerate profile_picture fresh from Zernio (URLs expire)
    if snap:
        try:
            accounts = refresh_service.z.list_accounts("instagram").get("accounts", [])
            if accounts:
                snap[0]["profile_picture"] = accounts[0].get("profilePicture")
        except Exception:
            pass
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
    now = datetime.now(timezone.utc)
    cur_start = (now - timedelta(days=30)).date().isoformat()
    prior_start = (now - timedelta(days=60)).date().isoformat()
    prior_end = cur_start
    with db.get_engine().connect() as conn:
        insights = _rows(conn, "SELECT * FROM account_insights_30d")
        agg_sql = """
            SELECT COALESCE(SUM(likes),0) likes, COALESCE(SUM(comments),0) comments,
                   COALESCE(SUM(saves),0) saves, COALESCE(SUM(shares),0) shares,
                   COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(reach),0) reach,
                   COALESCE(SUM(views),0) views, COALESCE(SUM(post_count),0) posts
            FROM daily_metrics WHERE date >= :a AND date < :b"""
        cur = _rows(conn, agg_sql, a=cur_start, b=now.date().isoformat() + "z")
        prior = _rows(conn, agg_sql, a=prior_start, b=prior_end)
        fh_recent = _rows(conn, "SELECT * FROM follower_history ORDER BY date DESC LIMIT 1")
        snap = _rows(conn, "SELECT followers_count FROM account_snapshot WHERE platform='instagram'")
        best = _rows(conn, """
            SELECT id, caption, permalink, picture, like_count, comment_count,
                   (like_count + comment_count * 3) AS score
            FROM posts ORDER BY score DESC LIMIT 1""")
        # Semanal (últimas 5 semanas iso, ancladas al lunes)
        weekly = _rows(conn, """
            SELECT to_char(date_trunc('week', date::date), 'YYYY-MM-DD') AS week_start,
                   COALESCE(SUM(post_count),0) posts,
                   COALESCE(SUM(likes),0) likes,
                   COALESCE(SUM(comments),0) comments,
                   COALESCE(SUM(shares),0) shares,
                   COALESCE(SUM(saves),0) saves,
                   COALESCE(SUM(reach),0) reach,
                   COALESCE(SUM(impressions),0) impressions,
                   COALESCE(SUM(views),0) views
            FROM daily_metrics WHERE date >= :a
            GROUP BY 1 ORDER BY 1""", a=(now - timedelta(days=35)).date().isoformat())
        daily_last30 = _rows(conn, """
            SELECT * FROM daily_metrics WHERE date >= :a ORDER BY date""", a=cur_start)
        fh_series = _rows(conn, """
            SELECT * FROM follower_history WHERE date >= :a ORDER BY date""",
            a=(now - timedelta(days=30)).date().isoformat())
        top_posts = _rows(conn, """
            SELECT id, caption, permalink, picture, created_time, like_count, comment_count,
                   (like_count + comment_count * 3) AS score
            FROM posts ORDER BY score DESC LIMIT 6""")
        freq = _rows(conn, "SELECT * FROM posting_frequency ORDER BY posts_per_week")
        decay = _rows(conn, "SELECT * FROM content_decay ORDER BY bucket_order")

    followers_now = (snap[0]["followers_count"] if snap else 0) or 0
    fh_30d_ago = _rows_get_delta(fh_series, followers_now)

    l30 = cur[0] if cur else {}
    p30 = prior[0] if prior else {}
    interactions_cur = (l30.get("likes", 0) + l30.get("comments", 0)
                        + l30.get("saves", 0) + l30.get("shares", 0))
    interactions_prior = (p30.get("likes", 0) + p30.get("comments", 0)
                          + p30.get("saves", 0) + p30.get("shares", 0))
    reach_cur = l30.get("reach", 0) or 0
    reach_prior = p30.get("reach", 0) or 0
    l30["engagement_rate"] = round((interactions_cur / reach_cur) * 100, 2) if reach_cur else 0.0
    p30["engagement_rate"] = round((interactions_prior / reach_prior) * 100, 2) if reach_prior else 0.0

    # Merge daily reach/impresiones a los top_posts (para tabla Top Performing)
    dm_by_date = {}
    for d in daily_last30:
        dm_by_date.setdefault(d["date"], []).append(d)
    for p in top_posts:
        d = (p.get("created_time") or "")[:10]
        entries = dm_by_date.get(d, [])
        one = len(entries) == 1 and (entries[0].get("post_count") or 0) == 1
        m = entries[0] if one else {}
        p["reach"] = m.get("reach")
        p["impressions"] = m.get("impressions")
        p["views"] = m.get("views")
        p["shares"] = m.get("shares")
        p["saves"] = m.get("saves")
        inter = (p.get("like_count") or 0) + (p.get("comment_count") or 0) \
            + (p.get("shares") or 0) + (p.get("saves") or 0)
        p["engagement_rate"] = round((inter / (m.get("reach") or 0)) * 100, 2) if m.get("reach") else None

    return {
        "insights": insights,
        "last30": l30,
        "prior30": p30,
        "followers": {"count": followers_now, "delta_30d": followers_now - fh_30d_ago},
        "follower_history_30d": fh_series,
        "follower_last": fh_recent[0] if fh_recent else None,
        "best_post": best[0] if best else None,
        "weekly": weekly,
        "daily_last30": daily_last30,
        "top_posts": top_posts,
        "platform_breakdown": [{
            "platform": "instagram", "posts": l30.get("posts", 0),
            "likes": l30.get("likes", 0), "comments": l30.get("comments", 0),
            "shares": l30.get("shares", 0), "saves": l30.get("saves", 0),
            "views": l30.get("views", 0), "impressions": l30.get("impressions", 0),
            "reach": l30.get("reach", 0), "engagement_rate": l30.get("engagement_rate", 0),
        }],
        "frequency": freq,
        "accumulation": decay,
    }


def _rows_get_delta(fh_series, current):
    """Devuelve el follower_count más antiguo de la serie, para calcular delta."""
    if not fh_series:
        return current
    return fh_series[0].get("follower_count") or current


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
        dm = _rows(conn, "SELECT * FROM daily_metrics")
        snap = _rows(conn, "SELECT followers_count FROM account_snapshot WHERE platform='instagram'")
    dm_by_date = {}
    for d in dm:
        dm_by_date.setdefault(d["date"], []).append(d)
    followers = (snap[0]["followers_count"] if snap else 0) or 0
    for p in rows:
        d = (p.get("created_time") or "")[:10]
        entries = dm_by_date.get(d, [])
        one_post_day = len(entries) == 1 and (entries[0].get("post_count") or 0) == 1
        m = entries[0] if one_post_day else {}
        p["reach"] = m.get("reach")
        p["impressions"] = m.get("impressions")
        p["views"] = m.get("views")
        p["shares"] = m.get("shares")
        p["saves"] = m.get("saves")
        interactions = (p.get("like_count") or 0) + (p.get("comment_count") or 0) \
            + (p.get("shares") or 0) + (p.get("saves") or 0)
        reach_val = p.get("reach") or 0
        p["engagement_rate"] = round((interactions / reach_val) * 100, 2) if reach_val else None
    return {"posts": rows, "followers": followers}


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


@api.get("/dashboard/inbox")
def inbox():
    from collections import defaultdict
    tz = ZoneInfo(TZ)
    with db.get_engine().connect() as conn:
        msgs = _rows(conn, "SELECT * FROM messages ORDER BY created_at")
        convs = _rows(conn, "SELECT * FROM conversations")
    received = sum(1 for m in msgs if m["direction"] == "incoming")
    sent = sum(1 for m in msgs if m["direction"] == "outgoing")

    # Agrupar mensajes por conversación
    by_conv = defaultdict(list)
    for m in msgs:
        by_conv[m["conversation_id"]].append(m)

    # Tiempo de respuesta: por cada mensaje entrante seguido de saliente, medir delta.
    response_deltas = []
    waiting = 0
    for cid, arr in by_conv.items():
        pending_inc = None
        for m in arr:
            if not m.get("created_at"):
                continue
            try:
                ts = datetime.fromisoformat(m["created_at"].replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
            if m["direction"] == "incoming":
                if pending_inc is None:
                    pending_inc = ts
            elif m["direction"] == "outgoing" and pending_inc is not None:
                delta = (ts - pending_inc).total_seconds()
                if delta >= 0:
                    response_deltas.append(delta)
                pending_inc = None
        if pending_inc is not None:
            waiting += 1

    def _median(vals):
        if not vals:
            return None
        s = sorted(vals)
        n = len(s)
        return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

    median_resp = _median(response_deltas)

    # Buckets de tiempo de respuesta
    bucket_defs = [
        ("0-1m", 0, 60),
        ("1-5m", 60, 300),
        ("5-15m", 300, 900),
        ("15-60m", 900, 3600),
        ("1-4h", 3600, 14400),
        ("4-24h", 14400, 86400),
        ("1d+", 86400, float("inf")),
    ]
    buckets = []
    total = len(response_deltas)
    cum = 0
    for label, lo, hi in bucket_defs:
        n = sum(1 for d in response_deltas if lo <= d < hi)
        cum += n
        buckets.append({"label": label, "count": n, "pct_cumulative": round(cum / total * 100) if total else 0})

    # Mensajes en el tiempo (por día, tz local)
    over_time_map = defaultdict(lambda: {"received": 0, "sent": 0})
    for m in msgs:
        if not m.get("created_at"):
            continue
        try:
            ts = datetime.fromisoformat(m["created_at"].replace("Z", "+00:00")).astimezone(tz)
        except (ValueError, TypeError):
            continue
        d = ts.date().isoformat()
        key = "received" if m["direction"] == "incoming" else "sent"
        over_time_map[d][key] += 1
    over_time = [{"date": d, **v} for d, v in sorted(over_time_map.items())]

    # Heatmap: cuándo llegan los mensajes (entrantes) por día de semana × hora local
    heatmap = defaultdict(int)
    for m in msgs:
        if m["direction"] != "incoming" or not m.get("created_at"):
            continue
        try:
            ts = datetime.fromisoformat(m["created_at"].replace("Z", "+00:00")).astimezone(tz)
        except (ValueError, TypeError):
            continue
        heatmap[(ts.weekday(), ts.hour)] += 1
    heatmap_slots = [{"day_of_week": d, "hour": h, "count": c} for (d, h), c in heatmap.items()]

    # Top participantes
    conv_meta = {c["id"]: c for c in convs}
    top = []
    for cid, arr in by_conv.items():
        meta = conv_meta.get(cid, {})
        recv = sum(1 for m in arr if m["direction"] == "incoming")
        snt = sum(1 for m in arr if m["direction"] == "outgoing")
        top.append({
            "conversation_id": cid,
            "name": meta.get("participant_name") or meta.get("participant_username") or "—",
            "username": meta.get("participant_username"),
            "received": recv,
            "sent": snt,
            "total": recv + snt,
        })
    top.sort(key=lambda x: x["total"], reverse=True)

    return {
        "totals": {
            "received": received,
            "sent": sent,
            "conversations": len(convs),
            "median_response_seconds": median_resp,
            "waiting_reply": waiting,
        },
        "response_time_buckets": buckets,
        "over_time": over_time,
        "when_messages_land": heatmap_slots,
        "top_participants": top[:10],
        "timezone": TZ,
    }


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
