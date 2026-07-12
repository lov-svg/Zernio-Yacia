import re

ADORATION_PATTERNS = [
    r"\bque\s+rico\b", r"\bque\s+delicia\b", r"\bdelicioso\b", r"\bhermoso\b",
    r"\bprecioso\b", r"\bbell[oa]\b", r"\bdivino\b", r"\bwow\b", r"\bincre[ií]ble\b",
    r"\bme\s+encanta\b", r"\bfelicidades\b", r"\bexcelente\b", r"\bperfecto\b",
    r"\bantojo\b", r"\bse\s+ve\s+rico\b", r"\bqu[eé]\s+lindo\b", r"\bamo\b",
]

BOT_PATTERNS = [
    r"gan[aá]\s+dinero", r"followers?\s+gratis", r"seguidores\s+gratis",
    r"promocion[a|á]\s+tu", r"colaboraci[oó]n\s+pagada", r"marketing\s+digital",
    r"crypto", r"inversi[oó]n\s+garantizada", r"click\s+en\s+mi\s+perfil",
    r"dm\s+for\s+promo", r"check\s+my\s+profile",
]

URL_ONLY_RE = re.compile(r"^\s*(https?://\S+\s*)+$", re.I)
EMAIL_ONLY_RE = re.compile(r"^\s*[\w.+-]+@[\w-]+\.[\w.]+\s*$")
EMOJI_PUNCT_RE = re.compile(r"^[\W\d_\s\u2600-\u27BF\U0001F000-\U0001FAFF]+$", re.U)


def _strip_adoration(text):
    t = text.lower()
    for p in ADORATION_PATTERNS:
        t = re.sub(p, "", t)
    return re.sub(r"[\W\d_]+", "", t, flags=re.U)


def is_likely_bot_message(text):
    t = (text or "").lower()
    return any(re.search(p, t) for p in BOT_PATTERNS)


def is_substantive_comment(text, min_len=20):
    if not text or URL_ONLY_RE.match(text) or EMAIL_ONLY_RE.match(text):
        return False
    if EMOJI_PUNCT_RE.match(text):
        return False
    if "?" in text or "¿" in text:
        return True
    return len(_strip_adoration(text)) >= 15


def substantive_dm(text, min_len=15):
    if not text or URL_ONLY_RE.match(text) or EMAIL_ONLY_RE.match(text):
        return False
    if EMOJI_PUNCT_RE.match(text):
        return False
    if is_likely_bot_message(text):
        return False
    if "?" in text or "¿" in text:
        return True
    return len(_strip_adoration(text)) >= 12
