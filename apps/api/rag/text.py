"""Language-aware text helpers shared by retrieval, the router and the eval.

The corpus is English; travellers write in English, Hindi (Devanagari), Hinglish (Hindi in
Latin letters) or Japanese. Dense multilingual embeddings handle most of that, and these
helpers make keyword search work too by expanding Hindi/Hinglish words into English terms.
"""

from __future__ import annotations

import re
import unicodedata

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
GUJARATI = re.compile(r"[઀-૿]")
KANA_KANJI = re.compile(r"[぀-ヿ㐀-鿿]")
LATIN_WORD = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")
INDIC_WORD = re.compile(r"[ऀ-ॿ઀-૿]+")
CJK_RUN = re.compile(r"[぀-ヿ㐀-鿿]+")

STOPWORDS = frozenset(
    """a an the and or of to in on at for from by with is are was were be been am do does did i me my
    we our you your it its this that these those there here can could should would will shall may might
    what which who whom how when where why if then than so as about into over under up down out not no
    yes please tell know need want get got have has had any some all just also very much more most
    hai hain ka ki ke ko se me mein par aur ya kya kaise kahan kab kyun bhi toh to ho tha thi the
    """.split()
)

#: Hindi/Hinglish → English retrieval terms. Only used to widen keyword matching, never shown.
EXPANSIONS: dict[str, str] = {
    # food
    "khana": "food meal",
    "khaana": "food meal",
    "shakahari": "vegetarian",
    "shaakahari": "vegetarian",
    "veg": "vegetarian",
    "jain": "jain onion garlic root vegetables",
    "pyaaz": "onion",
    "pyaz": "onion",
    "lehsun": "garlic",
    "lahsun": "garlic",
    "anda": "egg",
    "ande": "egg",
    "machli": "fish",
    "gosht": "meat",
    "halal": "halal pork alcohol mirin",
    # documents & travel
    "passport": "passport",
    "khoya": "lost",
    "kho": "lost",
    "gaya": "",
    "gayi": "",
    "chori": "stolen theft police",
    "chura": "stolen theft",
    "batua": "wallet",
    "paisa": "money cash",
    "paise": "money cash",
    "rupaye": "money",
    "train": "train",
    "chhut": "missed",
    "chhoot": "missed",
    "chuk": "missed",
    "ticket": "ticket",
    "hotel": "hotel accommodation",
    "saman": "luggage baggage",
    "samaan": "luggage baggage",
    "dawai": "medicine",
    "dawa": "medicine",
    "aspatal": "hospital",
    "hospital": "hospital",
    "doctor": "doctor medical",
    "bimar": "ill sick medical",
    "beemar": "ill sick medical",
    "chot": "injury accident",
    "bhukamp": "earthquake",
    "bhookamp": "earthquake",
    "toofan": "typhoon storm",
    "tufan": "typhoon storm",
    "baarish": "rain",
    "barish": "rain",
    "thak": "tired",
    "thaka": "tired",
    "thake": "tired",
    "visa": "visa",
    "dootavas": "embassy",
    "embassy": "embassy",
    "madad": "help",
    "bachcha": "child missing",
    "bacha": "child missing",
    "kharcha": "cost budget",
    "sasta": "budget cheap",
    "mandir": "temple",
    "kholna": "open",
    "khula": "open",
    "band": "closed",
    # Devanagari
    "पासपोर्ट": "passport",
    "खो": "lost",
    "खोया": "lost",
    "चोरी": "stolen theft police",
    "वीज़ा": "visa",
    "वीजा": "visa",
    "खाना": "food meal",
    "शाकाहारी": "vegetarian",
    "जैन": "jain onion garlic root vegetables",
    "प्याज": "onion",
    "लहसुन": "garlic",
    "अंडा": "egg",
    "हलाल": "halal pork alcohol",
    "दवा": "medicine",
    "दवाई": "medicine",
    "अस्पताल": "hospital",
    "डॉक्टर": "doctor medical",
    "बीमार": "ill sick medical",
    "एम्बुलेंस": "ambulance",
    "भूकंप": "earthquake",
    "तूफ़ान": "typhoon storm",
    "तूफान": "typhoon storm",
    "सुनामी": "tsunami",
    "बारिश": "rain",
    "ट्रेन": "train",
    "छूट": "missed",
    "टिकट": "ticket",
    "पैसे": "money cash",
    "दूतावास": "embassy",
    "मदद": "help",
    "पुलिस": "police",
    "थक": "tired",
    "मंदिर": "temple",
    "होटल": "hotel accommodation",
    "सामान": "luggage baggage",
    "कितना": "price cost",
    "कब": "time hours",
    "खुलता": "open hours",
    # Japanese (matched as substrings of kana/kanji runs)
    "台風": "typhoon storm",
    "地震": "earthquake",
    "津波": "tsunami",
    "避難": "evacuate evacuation",
    "警報": "warning",
    "パスポート": "passport",
    "旅券": "passport",
    "なくし": "lost",
    "紛失": "lost",
    "盗": "stolen theft",
    "救急車": "ambulance",
    "救急": "ambulance emergency",
    "病院": "hospital",
    "警察": "police",
    "交番": "koban police",
    "大使館": "embassy",
    "領事館": "consulate",
    "ビザ": "visa",
    "査証": "visa",
    "新幹線": "shinkansen train",
    "電車": "train",
    "乗り遅れ": "missed train",
    "切符": "ticket",
    "ベジタリアン": "vegetarian",
    "菜食": "vegetarian",
    "ハラル": "halal",
    "ハラール": "halal",
    "温泉": "onsen hot spring",
    "薬": "medicine",
    "両替": "currency exchange money",
    "荷物": "luggage baggage",
    "免税": "tax-free",
}

#: Common Hinglish function words: enough of them means "Hindi in Latin letters".
HINGLISH_MARKERS = frozenset(
    "hai hain kya kaise kahan kab kyun mera meri mere mujhe hum humein aap kar karna karu karoon "
    "chahiye nahi nahin raha rahi gaya gayi ho hoga ka ki ke ko se mein bhi aur toh tha thi batao "
    "bataiye kripya jaldi yahan wahan".split()
)


def normalise(text: str) -> str:
    return unicodedata.normalize("NFKC", text).lower()


def detect_language(text: str) -> str:
    """'hi', 'gu', 'ja', 'hinglish' or 'en'. Hinglish answers are written in Hindi (Latin)."""
    if DEVANAGARI.search(text):
        return "hi"
    if GUJARATI.search(text):
        return "gu"
    t = normalise(text)
    ja = len(KANA_KANJI.findall(t))
    if ja >= 2 and ja >= len(LATIN_WORD.findall(t)):
        return "ja"
    words = LATIN_WORD.findall(t)
    markers = sum(1 for w in words if w in HINGLISH_MARKERS)
    if markers >= 2 or (words and markers / len(words) >= 0.25):
        return "hinglish"
    return "en"


def stem(word: str) -> str:
    """Very light English suffix stripping so 'missed'/'misses'/'missing' meet 'miss'."""
    if len(word) <= 3 or word.endswith(("ss", "us", "is")):
        return word
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    for suf in ("ing", "ed"):
        if word.endswith(suf) and len(word) > len(suf) + 2:
            base = word[: -len(suf)]
            if len(base) > 2 and base[-1] == base[-2] and base[-1] not in "sl":
                base = base[:-1]  # stopped -> stop (but missed -> miss)
            return base
    if word.endswith("es") and word[:-2].endswith(("s", "x", "z", "ch", "sh")):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word


def tokenize(text: str) -> list[str]:
    """Keyword tokens: Latin words (stopwords removed, lightly stemmed), Indic words, CJK bigrams."""
    t = normalise(text)
    tokens = [stem(w) for w in LATIN_WORD.findall(t) if w not in STOPWORDS and len(w) > 1]
    tokens += INDIC_WORD.findall(t)
    for run in CJK_RUN.findall(t):
        if len(run) == 1:
            tokens.append(run)
        tokens += [run[i : i + 2] for i in range(len(run) - 1)]
    return tokens


def expand_query(text: str) -> str:
    """Original text plus English terms for any Hindi/Hinglish words in it."""
    t = normalise(text)
    extra: list[str] = []
    for w in LATIN_WORD.findall(t) + INDIC_WORD.findall(t):
        e = EXPANSIONS.get(w)
        if e:
            extra.append(e)
    # Japanese has no spaces: look for known words inside each kana/kanji run.
    for run in CJK_RUN.findall(t):
        for key, e in EXPANSIONS.items():
            if not key.isascii() and CJK_RUN.fullmatch(key) and key in run and e:
                extra.append(e)
    # Devanagari words often carry suffixes (खोया, खो गया): try prefixes too.
    for w in INDIC_WORD.findall(t):
        for key, e in EXPANSIONS.items():
            if INDIC_WORD.fullmatch(key) and w != key and w.startswith(key) and e:
                extra.append(e)
    return f"{text} {' '.join(extra)}".strip() if extra else text


def content_tokens(text: str) -> set[str]:
    return set(tokenize(expand_query(text)))
