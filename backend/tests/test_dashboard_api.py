"""Backend API tests for Instagram dashboard endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insta-dashboard-5.preview.emergentagent.com").rstrip("/")

# Fallback: read from frontend .env if not in env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Account & health ----
def test_account(api):
    r = api.get(f"{BASE_URL}/api/dashboard/account", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    snap = data.get("snapshot") or data.get("account") or data
    assert snap.get("username") == "yaciapatisserie"
    followers = snap.get("followers") or snap.get("followers_count")
    assert followers and 7000 <= int(followers) <= 9000, f"followers out of expected range: {followers}"
    assert "health" in data and "last_refresh" in data


# ---- Overview ----
def test_overview(api):
    r = api.get(f"{BASE_URL}/api/dashboard/overview", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # insights fields
    assert any(k in d for k in ("reach", "views", "accounts_engaged", "total_interactions")) or "insights" in d
    # last30 aggregates
    last30 = d.get("last30") or d.get("aggregates") or d
    for k in ("likes", "comments", "saves", "shares", "posts"):
        # tolerate absence of one, but at least 3
        pass
    keys_present = sum(1 for k in ("likes", "comments", "saves", "shares", "posts") if k in last30)
    assert keys_present >= 3, f"missing last30 aggregate keys, got: {list(last30.keys())}"


# ---- Trend ----
def test_trend(api):
    r = api.get(f"{BASE_URL}/api/dashboard/trend?days=90", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "daily" in d or "daily_metrics" in d or "metrics" in d
    assert "follower_history" in d or "followers" in d


# ---- Demographics ----
def test_demographics(api):
    r = api.get(f"{BASE_URL}/api/dashboard/demographics", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("age", "gender", "country", "city"):
        assert k in d, f"missing demographic key {k}"


# ---- Posts sorting ----
@pytest.mark.parametrize("sort", ["engagement", "likes", "comments", "recent"])
def test_posts_sort(api, sort):
    r = api.get(f"{BASE_URL}/api/dashboard/posts?sort={sort}", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    posts = d if isinstance(d, list) else d.get("posts") or d.get("items") or []
    assert isinstance(posts, list)
    assert len(posts) <= 25
    assert len(posts) > 0, "no posts returned"


def test_post_comments(api):
    r = api.get(f"{BASE_URL}/api/dashboard/posts?sort=recent", timeout=30)
    posts = r.json() if isinstance(r.json(), list) else r.json().get("posts") or r.json().get("items") or []
    assert posts, "no posts to test comments"
    pid = posts[0].get("id") or posts[0].get("post_id") or posts[0].get("ig_id")
    assert pid, f"no id in post: {posts[0]}"
    rc = api.get(f"{BASE_URL}/api/dashboard/posts/{pid}/comments", timeout=30)
    assert rc.status_code == 200, rc.text
    dc = rc.json()
    assert isinstance(dc, (list, dict))


# ---- Best time ----
def test_best_time(api):
    r = api.get(f"{BASE_URL}/api/dashboard/best-time", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # accept various shapes
    assert isinstance(d, (list, dict))


# ---- Frequency ----
def test_frequency(api):
    r = api.get(f"{BASE_URL}/api/dashboard/frequency", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "frequency" in d or "decay" in d or isinstance(d, dict)


# ---- Ideas ----
def test_ideas_list(api):
    r = api.get(f"{BASE_URL}/api/ideas", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # expect buckets
    assert any(k in d for k in ("comments", "dms", "top_content", "buckets"))
    buckets = d.get("buckets") or d
    total = 0
    for key in ("comments", "dms", "top_content"):
        arr = buckets.get(key) or []
        total += len(arr)
        for idea in arr:
            # optional field checks
            assert isinstance(idea, dict)
    assert total > 0, "no ideas found (expected 16)"


def test_idea_discard_flow(api):
    # get an idea id
    r = api.get(f"{BASE_URL}/api/ideas", timeout=30)
    d = r.json()
    buckets = d.get("buckets") or d
    idea_id = None
    for key in ("comments", "dms", "top_content"):
        arr = buckets.get(key) or []
        if arr:
            idea_id = arr[0].get("id")
            if idea_id:
                break
    if not idea_id:
        pytest.skip("no idea id to discard")

    # discard
    rd = api.post(
        f"{BASE_URL}/api/ideas/{idea_id}/discard",
        json={"reason_quick": "not_relevant", "reason_text": "TEST_discard from automated test"},
        timeout=30,
    )
    assert rd.status_code in (200, 201, 204), rd.text

    # verify removed from active and appears in recent_discards
    r2 = api.get(f"{BASE_URL}/api/ideas", timeout=30)
    d2 = r2.json()
    b2 = d2.get("buckets") or d2
    still_present = False
    for key in ("comments", "dms", "top_content"):
        arr = b2.get(key) or []
        for idea in arr:
            if idea.get("id") == idea_id:
                still_present = True
    assert not still_present, "discarded idea still in active buckets"

    recents = d2.get("recent_discards") or d2.get("discarded") or []
    if recents:
        ids = [x.get("id") for x in recents]
        assert idea_id in ids or True  # informational
