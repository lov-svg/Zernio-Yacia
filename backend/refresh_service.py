from datetime import datetime, timezone, timedelta
from sqlalchemy import text
import zernio_client as z
import db


def _now():
    return datetime.now(timezone.utc).isoformat()


def run_refresh(account_id):
    engine = db.get_engine()
    started = _now()
    detail = []
    with engine.begin() as conn:
        conn.execute(db.refresh_log.insert().values(started_at=started, status="running"))

    try:
        accounts = z.list_accounts("instagram").get("accounts", [])
        acc = accounts[0] if accounts else {}
        profile = (acc.get("metadata") or {}).get("profileData") or {}
        extra = profile.get("extraData") or {}

        health = z.get_account_health(account_id)
        insights = z.get_account_insights(account_id)
        demo = z.get_demographics(account_id)
        fh = z.get_follower_history(account_id)
        dm = z.get_daily_metrics(account_id)
        bt = z.get_best_time(account_id)
        pf = z.get_posting_frequency(account_id)
        cd = z.get_content_decay(account_id)
        inbox = z.list_inbox_posts(account_id)
        convs = z.list_conversations(account_id)

        with db.get_engine().begin() as conn:
            db.upsert(conn, db.account_snapshot, {
                "platform": "instagram",
                "username": acc.get("username"),
                "display_name": acc.get("displayName"),
                "profile_picture": acc.get("profilePicture"),
                "profile_url": acc.get("profileUrl"),
                "followers_count": acc.get("followersCount"),
                "bio": profile.get("bio"),
                "media_count": extra.get("mediaCount"),
                "fetched_at": _now(),
            }, ["platform"])

            token = health.get("tokenStatus") or {}
            perms = health.get("permissions") or {}
            db.upsert(conn, db.account_health, {
                "platform": "instagram",
                "status": health.get("status"),
                "token_valid": 1 if token.get("valid") else 0,
                "token_expires_at": token.get("expiresAt"),
                "can_fetch_analytics": 1 if perms.get("canFetchAnalytics") else 0,
                "fetched_at": _now(),
            }, ["platform"])

            dr = insights.get("dateRange") or {}
            for metric, obj in (insights.get("metrics") or {}).items():
                db.upsert(conn, db.account_insights_30d, {
                    "metric": metric, "value": float(obj.get("total") or 0),
                    "since_date": dr.get("since"), "until_date": dr.get("until"),
                    "fetched_at": _now(),
                }, ["metric"])

            conn.execute(text("DELETE FROM demographics"))
            for dim, rows in (demo.get("demographics") or {}).items():
                for r in rows:
                    db.upsert(conn, db.demographics, {
                        "dimension_type": dim, "bucket": str(r.get("dimension")),
                        "value": int(r.get("value") or 0),
                    }, ["dimension_type", "bucket"])

            fhm = fh.get("metrics") or {}
            db.upsert(conn, db.follower_history, {
                "date": datetime.now(timezone.utc).date().isoformat(),
                "follower_count": int((fhm.get("follower_count") or {}).get("total") or 0),
                "followers_gained": int((fhm.get("followers_gained") or {}).get("total") or 0),
                "followers_lost": int((fhm.get("followers_lost") or {}).get("total") or 0),
            }, ["date"])

            for day in dm.get("dailyData") or []:
                m = day.get("metrics") or {}
                db.upsert(conn, db.daily_metrics, {
                    "date": day.get("date"),
                    "impressions": int(m.get("impressions") or 0),
                    "reach": int(m.get("reach") or 0),
                    "likes": int(m.get("likes") or 0),
                    "comments": int(m.get("comments") or 0),
                    "shares": int(m.get("shares") or 0),
                    "saves": int(m.get("saves") or 0),
                    "views": int(m.get("views") or 0),
                    "post_count": int(day.get("postCount") or 0),
                }, ["date"])
            cutoff = (datetime.now(timezone.utc) - timedelta(days=180)).date().isoformat()
            conn.execute(text("DELETE FROM daily_metrics WHERE date < :c"), {"c": cutoff})

            conn.execute(text("DELETE FROM best_time"))
            for s in bt.get("slots") or []:
                db.upsert(conn, db.best_time, {
                    "day_of_week": int(s.get("day_of_week") or 0),
                    "hour": int(s.get("hour") or 0),
                    "avg_engagement": float(s.get("avg_engagement") or 0),
                    "post_count": int(s.get("post_count") or 0),
                }, ["day_of_week", "hour"])

            conn.execute(text("DELETE FROM posting_frequency"))
            for f in pf.get("frequency") or []:
                db.upsert(conn, db.posting_frequency, {
                    "posts_per_week": int(f.get("posts_per_week") or 0),
                    "avg_engagement_rate": float(f.get("avg_engagement_rate") or 0),
                    "avg_engagement": float(f.get("avg_engagement") or 0),
                    "weeks_count": int(f.get("weeks_count") or 0),
                }, ["posts_per_week"])

            conn.execute(text("DELETE FROM content_decay"))
            for b in cd.get("buckets") or []:
                db.upsert(conn, db.content_decay, {
                    "bucket_order": int(b.get("bucket_order") or 0),
                    "bucket_label": b.get("bucket_label"),
                    "avg_pct_of_final": float(b.get("avg_pct_of_final") or 0),
                    "post_count": int(b.get("post_count") or 0),
                }, ["bucket_order"])

            post_items = inbox.get("data") or []
            for p in post_items:
                db.upsert(conn, db.posts, {
                    "id": str(p.get("id")),
                    "caption": p.get("content"),
                    "created_time": p.get("createdTime"),
                    "permalink": p.get("permalink"),
                    "picture": p.get("picture"),
                    "like_count": int(p.get("likeCount") or 0),
                    "comment_count": int(p.get("commentCount") or 0),
                }, ["id"])
            detail.append(f"{len(post_items)} posts")

            n_comments = 0
            for p in post_items:
                if not p.get("commentCount"):
                    continue
                try:
                    cresp = z.get_post_comments(account_id, p["id"])
                except RuntimeError:
                    continue
                clist = cresp.get("data") or cresp.get("comments") or []
                for c in clist:
                    if not isinstance(c, dict) or not c.get("id"):
                        continue
                    frm = c.get("from") or {}
                    if (frm.get("isOwner") if isinstance(frm, dict) else False):
                        continue
                    db.upsert(conn, db.comments, {
                        "id": str(c.get("id")),
                        "post_id": str(p.get("id")),
                        "username": (frm.get("username") or frm.get("name")) if isinstance(frm, dict) else str(frm or ""),
                        "text": c.get("text") or c.get("content") or c.get("message"),
                        "created_time": c.get("createdTime") or c.get("timestamp") or c.get("created_time"),
                        "like_count": int(c.get("likeCount") or c.get("like_count") or 0),
                    }, ["id"])
                    n_comments += 1
            detail.append(f"{n_comments} comentarios")
            ccut = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
            conn.execute(text("DELETE FROM comments WHERE created_time < :c AND created_time IS NOT NULL"), {"c": ccut})

            conv_items = convs.get("data") or []
            n_msgs = 0
            for cv in conv_items[:30]:
                db.upsert(conn, db.conversations, {
                    "id": str(cv.get("id")),
                    "participant_name": cv.get("participantName"),
                    "participant_username": cv.get("participantUsername"),
                    "last_message": cv.get("lastMessage"),
                    "updated_time": cv.get("updatedTime"),
                }, ["id"])
                try:
                    mresp = z.get_conversation_messages(account_id, cv["id"])
                except RuntimeError:
                    continue
                for m in mresp.get("messages") or []:
                    if not m.get("id"):
                        continue
                    db.upsert(conn, db.messages, {
                        "id": str(m.get("id")),
                        "conversation_id": str(cv.get("id")),
                        "text": m.get("message"),
                        "direction": m.get("direction"),
                        "sender_name": m.get("senderName"),
                        "created_at": m.get("createdAt"),
                    }, ["id"])
                    n_msgs += 1
            detail.append(f"{len(conv_items)} conversaciones, {n_msgs} mensajes")
            mcut = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            conn.execute(text("DELETE FROM messages WHERE created_at < :c AND created_at IS NOT NULL"), {"c": mcut})

            conn.execute(db.refresh_log.insert().values(
                started_at=started, finished_at=_now(), status="ok", detail="; ".join(detail)))
        return {"status": "ok", "detail": "; ".join(detail)}
    except Exception as e:
        with db.get_engine().begin() as conn:
            conn.execute(db.refresh_log.insert().values(
                started_at=started, finished_at=_now(), status="error", detail=str(e)[:500]))
        raise
