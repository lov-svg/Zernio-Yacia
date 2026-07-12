import os
import time
import requests

BASE = "https://api.zernio.com/v1"


def _headers():
    return {"Authorization": f"Bearer {os.environ['ZERNIO_API_KEY']}"}


def _get(path, params=None):
    last_err = None
    for delay in (0, 2, 3, 5):
        if delay:
            time.sleep(delay)
        try:
            r = requests.get(f"{BASE}{path}", headers=_headers(), params=params or {}, timeout=60)
            if r.status_code >= 500 or r.status_code == 429:
                last_err = f"HTTP {r.status_code}"
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last_err = str(e)
    raise RuntimeError(f"Zernio error en {path}: {last_err}")


def list_accounts(platform="instagram"):
    return _get("/accounts", {"platform": platform})


def get_account_health(account_id):
    return _get(f"/accounts/{account_id}/health")


def get_account_insights(account_id):
    return _get("/analytics/instagram/account-insights", {"accountId": account_id})


def get_demographics(account_id):
    return _get("/analytics/instagram/demographics", {"accountId": account_id})


def get_follower_history(account_id):
    return _get("/analytics/instagram/follower-history", {"accountId": account_id})


def get_daily_metrics(account_id):
    return _get("/analytics/daily-metrics", {"accountId": account_id, "platform": "instagram"})


def get_best_time(account_id):
    return _get("/analytics/best-time", {"accountId": account_id, "platform": "instagram"})


def get_posting_frequency(account_id):
    return _get("/analytics/posting-frequency", {"accountId": account_id, "platform": "instagram"})


def get_content_decay(account_id):
    return _get("/analytics/content-decay", {"accountId": account_id, "platform": "instagram"})


def list_inbox_posts(account_id, limit=50):
    return _get("/inbox/comments", {"accountId": account_id, "platform": "instagram", "limit": limit})


def get_post_comments(account_id, post_id):
    return _get(f"/inbox/comments/{post_id}", {"accountId": account_id})


def list_conversations(account_id):
    return _get("/inbox/conversations", {"accountId": account_id})


def get_conversation_messages(account_id, conversation_id):
    return _get(f"/inbox/conversations/{conversation_id}/messages", {"accountId": account_id})
