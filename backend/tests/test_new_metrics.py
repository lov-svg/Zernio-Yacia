"""Backend tests for new metrics: overview extras, posts extras, and inbox."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insta-dashboard-5.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Overview new fields ----
def test_overview_last30_new_fields(api):
    r = api.get(f"{BASE_URL}/api/dashboard/overview", timeout=30)
    assert r.status_code == 200
    d = r.json()
    l30 = d["last30"]
    for k in ("impressions", "reach", "views", "engagement_rate"):
        assert k in l30, f"missing {k} in last30"
    assert isinstance(l30["engagement_rate"], (int, float))
    assert l30["impressions"] >= 0
    assert l30["reach"] >= 0


def test_overview_best_post(api):
    d = api.get(f"{BASE_URL}/api/dashboard/overview", timeout=30).json()
    bp = d.get("best_post")
    assert bp is not None, "best_post missing"
    for k in ("id", "caption", "permalink", "picture", "like_count", "comment_count"):
        assert k in bp, f"best_post missing {k}"


# ---- Posts new metrics ----
def test_posts_have_new_metrics(api):
    d = api.get(f"{BASE_URL}/api/dashboard/posts?sort=engagement", timeout=30).json()
    posts = d["posts"]
    assert len(posts) > 0
    # All posts must have the keys present (may be None if multi-post day)
    for p in posts:
        for k in ("reach", "impressions", "views", "shares", "saves", "engagement_rate"):
            assert k in p, f"post {p.get('id')} missing {k}"
    # At least one post should have numeric reach (post_count=1 day)
    with_reach = [p for p in posts if isinstance(p.get("reach"), (int, float)) and p.get("reach") > 0]
    assert len(with_reach) > 0, "expected at least one post with numeric reach"
    p = with_reach[0]
    assert isinstance(p["impressions"], (int, float))
    assert isinstance(p["engagement_rate"], (int, float))


# ---- Inbox ----
def test_inbox_totals(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    t = d["totals"]
    assert t["received"] == 458, f"received={t['received']}"
    assert t["sent"] == 508, f"sent={t['sent']}"
    assert t["conversations"] == 30, f"conversations={t['conversations']}"
    assert "median_response_seconds" in t
    assert "waiting_reply" in t


def test_inbox_response_time_buckets(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    buckets = d["response_time_buckets"]
    assert len(buckets) == 7, f"expected 7 buckets, got {len(buckets)}"
    for b in buckets:
        for k in ("label", "count", "pct_cumulative"):
            assert k in b
    # cumulative should be non-decreasing
    pcts = [b["pct_cumulative"] for b in buckets]
    assert pcts == sorted(pcts), f"pct_cumulative not monotonic: {pcts}"


def test_inbox_over_time(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    ot = d["over_time"]
    assert isinstance(ot, list) and len(ot) > 0
    for row in ot[:3]:
        for k in ("date", "received", "sent"):
            assert k in row


def test_inbox_when_messages_land(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    wml = d["when_messages_land"]
    assert isinstance(wml, list) and len(wml) > 0
    for cell in wml:
        assert 0 <= cell["day_of_week"] <= 6
        assert 0 <= cell["hour"] <= 23
        assert cell["count"] >= 0


def test_inbox_top_participants(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    tp = d["top_participants"]
    assert isinstance(tp, list)
    assert len(tp) <= 10
    assert len(tp) > 0
    for p in tp:
        for k in ("name", "received", "sent", "total"):
            assert k in p, f"participant missing {k}"
        assert p["total"] == p["received"] + p["sent"] or p["total"] >= 0


def test_inbox_timezone(api):
    d = api.get(f"{BASE_URL}/api/dashboard/inbox", timeout=30).json()
    assert d.get("timezone") == "America/Mexico_City"
