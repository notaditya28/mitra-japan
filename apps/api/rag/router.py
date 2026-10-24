"""Intent router. Deterministic rules run first (and always win for emergencies); an LLM
classifier is only consulted in live mode for messages the rules can't place confidently.

Intents: emergency | plan_change | info | smalltalk
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .text import normalise

EmergencyKind = str  # lost_passport | lost_belongings | medical | police | earthquake | typhoon_tsunami | stranded | missing_person


def _rx(*parts: str) -> re.Pattern[str]:
    return re.compile("|".join(parts), re.IGNORECASE)


# --- emergency vocab (EN / Hinglish / Hindi / Japanese) -----------------------------------
EMERGENCY_RULES: list[tuple[EmergencyKind, re.Pattern[str]]] = [
    (
        "lost_passport",
        _rx(
            r"passport\b.*\b(lost|lose|missing|stolen|gone|kho|khoya|chori|can'?t find|cannot find)",
            r"\b(lost|lose|losing|stolen|misplaced)\b.*\bpassport",
            r"passport.*(kho gaya|kho gayi|kho diya|chori ho)",
            r"पासपोर्ट.*(खो|चोरी|गुम)",
            r"(パスポート|旅券).*(なくし|紛失|盗まれ|無くし)",
        ),
    ),
    (
        "medical",
        _rx(
            r"\b(ambulance|unconscious|not breathing|can'?t breathe|cannot breathe|heart attack|chest pain|stroke|seizure|"
            r"bleeding|fainted|collapsed|severe allerg|anaphyla|overdose|broken (leg|arm|bone)|choking|heatstroke|heat stroke)\b",
            r"\b(need|call|get) (a |an )?(doctor|ambulance|hospital)\b",
            r"\b(emergency|urgent).*(doctor|hospital|medical)\b",
            r"\b(very|really) (sick|ill)\b",
            r"\b(behosh|saans nahi|seene mein dard|khoon beh|ambulance bulao|doctor chahiye|hospital le jao)\b",
            r"(एम्बुलेंस|बेहोश|सांस नहीं|सीने में दर्द|खून|अस्पताल ले|डॉक्टर चाहिए)",
            r"(救急車|意識がない|息ができない|胸が痛い|出血|倒れ)",
        ),
    ),
    (
        "police",
        _rx(
            r"\b(robbed|mugged|assaulted|attacked|harass|stalk|someone stole|was stolen|been stolen|theft|pickpocket|scam(med)?|threaten)",
            r"\b(call|need) (the )?police\b",
            r"\b(chori ho gay|loot liya|police bulao)",
            r"(चोरी हो|लूट|पुलिस बुलाओ|पुलिस को)",
            r"(盗まれ|警察を呼|泥棒|ひったくり)",
        ),
    ),
    (
        "lost_belongings",
        _rx(
            r"\b(lost|left|stolen|can'?t find|cannot find)\b.*\b(phone|wallet|purse|bag|cards?|credit card|money|luggage|suitcase)\b",
            r"\b(phone|wallet|purse|bag|card|luggage)\b.*\b(lost|stolen|missing|kho gaya|kho gayi|chori)",
            r"(फ़ोन|फोन|बटुआ|पर्स|बैग|कार्ड).*(खो|चोरी)",
            r"(財布|携帯|スマホ|かばん|カバン).*(なくし|落とし|盗まれ)",
        ),
    ),
    (
        "earthquake",
        _rx(
            r"\b(earthquake|quake|tremor|shaking)\b.*\b(now|right now|just|happening|strong|big|felt|again|help)\b",
            r"\b(there'?s|there is|we had|just had|feeling) (an? )?(earthquake|quake|tremor|strong shaking)",
            r"\b(bhukamp|bhookamp)\b.*\b(aaya|aa raha|abhi)",
            r"भूकंप.*(आया|आ रहा|अभी)",
            r"(地震だ|地震が(あった|起き|来)|揺れ(て|た|が強))",
            r"earthquake warning|earthquake early warning|緊急地震速報",
        ),
    ),
    (
        "typhoon_tsunami",
        _rx(
            r"\b(tsunami)\b",
            r"\btyphoon\b.*\b(now|coming|tonight|today|warning|approaching|hitting|stuck|help)\b",
            r"\b(evacuat(e|ion) (order|warning|now))",
            r"\b(toofan|tufan)\b.*\b(aa raha|aaya|abhi)",
            r"(सुनामी|तूफ़ान.*(आ रहा|आया)|तूफान.*(आ रहा|आया))",
            r"(津波|台風が(来|接近)|避難(指示|して))",
        ),
    ),
    (
        "missing_person",
        _rx(
            r"\b(can'?t|cannot) find my (child|son|daughter|kid|mother|father|mom|dad|wife|husband|parents?|grandmother|grandfather)",
            r"\bmy (child|son|daughter|kid|mother|father|mom|dad|wife|husband|parents?|grandmother|grandfather) (is|are) (missing|lost)",
            r"\b(missing|lost) (child|kid|person)\b",
            r"\b(bachcha|beta|beti|maa|papa|mummy).*(kho gaya|kho gayi|kho gaye|nahi mil raha|nahi mil rahi|nahi mil rahe|gum)",
            r"(बच्चा|बेटा|बेटी|मां|पापा|माँ).*(खो|नहीं मिल|गुम)",
            r"(子ども|子供|母|父).*(いない|迷子|見つからない)",
        ),
    ),
    (
        "stranded",
        _rx(
            r"\b(trains?|shinkansen|flights?|service|line)\b.*\b(suspended|cancel+ed|stopped|not running)\b.*\b(stuck|stranded|nowhere|tonight|help)",
            r"\b(stranded|stuck)\b.*\b(station|airport|train|no hotel|nowhere to stay)",
            r"(運休|運転見合わせ).*(帰れ|泊ま)",
            r"\b(phans gaye|atak gaye|fas gaye)\b",
            r"(फंस गए|अटक गए)",
        ),
    ),
]

#: "What should I do if...?" questions are preparation, not an emergency happening now.
HYPOTHETICAL = _rx(
    r"\b(what (should|do|would) (i|we) do if|what if|in case|if (i|we|my|someone) (lose|lost|get|have|need)|how (do|can) (i|we) (prepare|avoid)|"
    r"before (my|our|the) trip|planning|should i (carry|bring|pack)|is it safe|are there (many )?earthquakes|how often|how (do|can|would|should) (i|we|you|one) (call|contact|get|reach|find|report|apply))\b",
    r"\b(agar|yadi)\b",
    r"(अगर|यदि)",
    r"(もし|場合は|たら(どう|何|いい)|ときは)",
)
URGENT = _rx(r"\b(help|urgent|now|right now|immediately|please|jaldi|abhi|turant)\b", r"!", r"(मदद|जल्दी|अभी|助けて|今すぐ)")

PLAN_CHANGE = _rx(
    r"\b(add|remove|drop|skip|replace|swap|move|change|shorten|extend|reschedule|rearrange|reorder|cancel)\b.*\b(day|stop|days|itinerary|plan|trip|visit|lunch|dinner|restaurant|temple|museum)\b",
    r"\b(add|another|extra|one more|two more|\d+ more) (day|days|night|nights)\b",
    r"\b(less|more) (tiring|relaxed|packed|walking|rushed)\b",
    r"\b(lighter|slower|easier|relaxed) (day|days|pace|plan|itinerary)\b",
    r"\b(make|keep)\b.*\b(lighter|easier|more relaxed|slower|shorter|less busy)\b",
    r"\b(i'?m|we'?re|i am|we are|parents are|feeling) (so |very |too )?(tired|exhausted|sick of walking)\b",
    r"\b(it'?s|it is) (raining|pouring|snowing|too hot|very hot)\b",
    r"\brain(ing|y)?\b.*\b(today|tomorrow|day \d|outdoor|plan)\b",
    r"\b(only|just) (have|got) \d+ (hours?|hrs?)\b",
    r"\b(restaurant|place|temple|museum|shop|attraction|it)\b.*\b(is|was) (closed|shut|full)\b",
    r"\breplan\b",
    r"\b(thak gaye|thak gaya|thak gayi|baarish ho rahi|barish ho rahi|plan badlo|din badhao|ek din aur)\b",
    r"(थक गए|थक गया|बारिश हो रही|प्लान बदल|एक दिन और)",
    r"(雨が降|疲れ)",
)
SMALLTALK = _rx(r"^\s*(hi|hello|hey|namaste|namaskar|thanks|thank you|thank u|dhanyavad|shukriya|ok|okay|cool|bye|good (morning|night))[\s!.]*$")


@dataclass
class Route:
    intent: str
    emergency_kind: EmergencyKind | None = None
    confidence: float = 1.0
    reasons: list[str] = field(default_factory=list)
    hypothetical: bool = False


def route(message: str, has_itinerary: bool = False) -> Route:
    text = normalise(message)
    hypothetical = bool(HYPOTHETICAL.search(text))
    for kind, rx in EMERGENCY_RULES:
        if rx.search(text):
            if hypothetical and not URGENT.search(text):
                # Preparation question about an emergency topic: answer from sources, but say
                # how to get help, with the emergency topic filter on.
                return Route("info", kind, 0.8, [f"hypothetical {kind}"], hypothetical=True)
            return Route("emergency", kind, 1.0, [f"rule:{kind}"])
    if SMALLTALK.match(text):
        return Route("smalltalk", reasons=["rule:smalltalk"])
    if PLAN_CHANGE.search(text):
        if has_itinerary:
            return Route("plan_change", reasons=["rule:plan_change"])
        return Route("info", confidence=0.6, reasons=["plan_change without itinerary"])
    return Route("info", confidence=0.7, reasons=["default"])


#: Weak signals that justify asking the LLM classifier (live mode only).
WEAK_EMERGENCY = _rx(r"\b(scared|afraid|panic|lost|hurt|pain|sick|ill|police|danger|alone|stuck)\b", r"(डर|दर्द|बीमार|怖い)")


def needs_llm_check(message: str, r: Route) -> bool:
    return r.intent == "info" and not r.hypothetical and bool(WEAK_EMERGENCY.search(normalise(message)))
