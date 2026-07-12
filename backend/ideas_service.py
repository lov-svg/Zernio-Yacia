import os
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import text
import anthropic
import db
from idea_filters import is_substantive_comment, substantive_dm

MODEL = "claude-sonnet-4-5"
ID_STRIP_RE = re.compile(r"\b\d{10,}\b|\b[0-9a-f]{16,}\b", re.I)


def _system_prompt():
    return (Path(__file__).parent / "prompts" / "ideas_system.md").read_text()


def _clean(t):
    return ID_STRIP_RE.sub("", t or "").strip()


def _build_context(conn):
    top_posts = conn.execute(text(
        "SELECT id, caption, permalink, like_count, comment_count, created_time FROM posts "
        "ORDER BY (like_count + comment_count*3) DESC LIMIT 15")).mappings().all()
    raw_comments = conn.execute(text(
        "SELECT c.id, c.text, c.post_id, c.username FROM comments c ORDER BY c.created_time DESC NULLS LAST LIMIT 300"
    )).mappings().all()
    raw_dms = conn.execute(text(
        "SELECT id, text, sender_name FROM messages WHERE direction = 'incoming' ORDER BY created_at DESC LIMIT 300"
    )).mappings().all()
    demo = conn.execute(text(
        "SELECT dimension_type, bucket, value FROM demographics ORDER BY dimension_type, value DESC")).mappings().all()
    best = conn.execute(text(
        "SELECT day_of_week, hour, avg_engagement FROM best_time ORDER BY avg_engagement DESC LIMIT 5")).mappings().all()

    comments = [c for c in raw_comments if is_substantive_comment(c["text"] or "")][:120]
    dms = [m for m in raw_dms if substantive_dm(m["text"] or "")][:120]

    parts = ["# CONTEXTO DE LA CUENTA (Instagram @yaciapatisserie, pastelería en Guadalajara, México)\n"]
    parts.append("## Top posts por rendimiento")
    for p in top_posts:
        parts.append(f"- post_id={p['id']} | likes={p['like_count']} comentarios={p['comment_count']} | caption: {(p['caption'] or '')[:280]}")
    parts.append("\n## Comentarios sustantivos recientes")
    for c in comments:
        parts.append(f"- comment_id={c['id']} (en post_id={c['post_id']}): \"{(c['text'] or '')[:300]}\"")
    parts.append("\n## DMs sustantivos recientes (entrantes)")
    for m in dms:
        parts.append(f"- message_id={m['id']}: \"{(m['text'] or '')[:300]}\"")
    parts.append("\n## Demografía de seguidores")
    by_dim = {}
    for d in demo:
        by_dim.setdefault(d["dimension_type"], []).append(f"{d['bucket']}: {d['value']}")
    for dim, rows in by_dim.items():
        parts.append(f"- {dim}: " + ", ".join(rows[:8]))
    parts.append("\n## Mejores horarios históricos (UTC, day_of_week 0-6)")
    for b in best:
        parts.append(f"- día {b['day_of_week']} hora {b['hour']}h: engagement promedio {b['avg_engagement']}")
    stats = {"n_comments": len(comments), "n_dms": len(dms), "n_posts": len(top_posts)}
    return "\n".join(parts), stats


def _recent_discards(conn):
    rows = conn.execute(text(
        "SELECT source_bucket, angle, reason_quick, reason_text FROM idea_discards "
        "ORDER BY id DESC LIMIT 50")).mappings().all()
    if not rows:
        return ""
    lines = ["\n## Ideas que la usuaria YA descartó (NO repetir ni hacer variantes muy similares)"]
    for r in rows:
        reason = r["reason_quick"] or ""
        if r["reason_text"]:
            reason += f" ({r['reason_text']})"
        lines.append(f"[{r['source_bucket']}] \"{r['angle']}\" razón: {reason}")
    lines.append("Aprende de estos descartes: identifica patrones (ángulos, formatos o temas que no le gustan) y no propongas variantes similares en esta generación.")
    return "\n".join(lines)


def _instructions(bucket, stats):
    if bucket == "comments":
        dist = "Genera hasta 10 ideas del bucket 'comments' únicamente."
    elif bucket == "dms":
        dist = "Genera hasta 5 ideas del bucket 'dms' únicamente."
    elif bucket == "top_content":
        dist = "Genera hasta 10 ideas del bucket 'top_content' únicamente."
    else:
        dist = ("Genera ideas para Instagram con esta distribución objetivo: "
                "10 de 'comments' + 5 de 'dms' + 10 de 'top_content' = 25 ideas. "
                "Son OBJETIVOS, no requisitos: si no hay sustancia suficiente, entrega menos.")
    return (f"{dist}\n"
            f"Datos disponibles: {stats['n_comments']} comentarios sustantivos, {stats['n_dms']} DMs sustantivos, {stats['n_posts']} top posts.\n"
            "Responde SOLO con el JSON del esquema indicado en el system prompt.")


def _parse_json(raw):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def generate_ideas(bucket=None):
    engine = db.get_engine()
    with engine.connect() as conn:
        context, stats = _build_context(conn)
        discards = _recent_discards(conn)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": context, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": _instructions(bucket, stats) + discards},
            ],
        }],
    )
    raw = msg.content[0].text
    data = _parse_json(raw)
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    saved = []
    with engine.begin() as conn:
        if bucket:
            conn.execute(text("UPDATE ideas SET discarded = 2 WHERE source_bucket = :b AND discarded = 0"), {"b": bucket})
        else:
            conn.execute(text("UPDATE ideas SET discarded = 2 WHERE discarded = 0"))
        for i in data.get("ideas", []):
            sb = i.get("source_bucket", "top_content")
            if bucket and sb != bucket:
                continue
            res = conn.execute(db.ideas.insert().returning(db.ideas.c.id).values(
                generated_at=now, batch_id=batch_id, source_bucket=sb,
                angle=_clean(i.get("angle")), format=i.get("format"),
                rationale=i.get("rationale") or "",
                evidence_quotes=json.dumps(i.get("evidence_quotes") or [], ensure_ascii=False),
                why_good_idea=_clean(i.get("why_good_idea")),
                suggested_angle=_clean(i.get("suggested_angle")),
                basis_post_ids=json.dumps(i.get("basis_post_ids") or []),
                basis_comment_ids=json.dumps(i.get("basis_comment_ids") or []),
                basis_message_ids=json.dumps(i.get("basis_message_ids") or []),
                discarded=0,
            ))
            saved.append(res.scalar())
    return {"batch_id": batch_id, "count": len(saved)}
