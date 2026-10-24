# Mitra Japan assistant: evaluation report

Generated 2026-10-24T15:21:40 · mode: **demo** · cases: 19

Thresholds were tuned on the **dev** split only; **held-out** numbers are the honest ones.
Groundedness here is a lexical check (≥60% of a cited fact's words appear in the cited chunk). It is
imperfect: it can't catch a fact that reuses the source's words with a wrong meaning. Run with `--judge`
in live mode for an LLM judge, and spot-check by hand (sample below).

| Metric | dev | held-out | all |
| --- | --- | --- | --- |
| hit@1 | n/a | 100% | 100% |
| hit@3 | n/a | 100% | 100% |
| hit@5 | n/a | 100% | 100% |
| mrr | n/a | 1.00 | 1.00 |
| citation_precision | n/a | 100% | 100% |
| groundedness | n/a | 100% | 100% |
| abstain_precision | n/a | 67% | 67% |
| abstain_recall | n/a | 100% | 100% |
| emergency_routing | n/a | 100% | 100% |
| patch_validity | n/a | 100% | 100% |
| unaffected_preserved | n/a | 100% | 100% |
| safety_checks | n/a | 100% | 100% |
| latency_p50_ms | None | 5 | 5 |
| latency_p95_ms | None | 7 | 7 |
| passed | 0 | 18 | 18 |
| cases | 0 | 19 | 19 |

## Failures (1)

### c072 (heldout, x-topic): Where can I withdraw cash with an Indian debit card?

- failed: abstain
- intent: info · confidence: abstained · cited: []
- answer:

```
Suggestion: I can't verify that from my sources, so I won't guess.
```
  - payments-jnto-currency#0 score=0.8725 dense=0.8164 bm25_rank=1 cov=0.4
  - emergency-embassy-india-tokyo#1 score=0.8628 dense=0.8312 bm25_rank=10 cov=0.2
  - payments-jnto-wifi#0 score=0.8566 dense=0.8012 bm25_rank=6 cov=0.4
  - luggage-jnto-storage-delivery#0 score=0.8539 dense=0.7985 bm25_rank=4 cov=0.4
  - emergency-cgi-osaka-lost-passport#0 score=0.8514 dense=0.82 bm25_rank=14 cov=0.2

## Hand-check sample (first 5 answered info cases)

**Can I show a screenshot of my eVISA at the airport?** → cited ['visa-mofa-evisa']

```
Travellers with an eVISA must show the "Visa issuance notice" on screen with an internet connection. The page states that a PDF, screenshot or printed copy is not accepted. [1]
Beware of fraudulent websites that look like the JAPAN eVISA site. [1]
```

**japan ka visa kaise milega mujhe** → cited ['visa-embassy-india']

```
Applications from India are submitted through VFS Global (the embassy's page says no prior appointment is needed). VFS site: https://visa.vfsglobal.com/ind/en/jpn/ [1]
Japan Visa Information Hotline (listed on the page): +91-(0)11-7181-6614, open 24×7, English only. [1]
Suggestion: (Demo mode answers in English; the live guide answers in your language.)
```

**What should I do if I lose my passport?** → cited ['emergency-cgi-osaka-lost-passport']

```
This is the guidance from the Consulate General of India, Osaka-Kobe. It applies to Indian tourists who lose their passport in the consulate's area: Kansai: Mie, Shiga, Kyoto, Osaka, Hyogo, Nara, Wakayama; Chugoku: Tottori, Shimane, Okayama, Hiroshima (including Miyajima), Yamaguchi; Shikoku: Tokushima, Kagawa, Ehime, Kochi. [1]
one passport-size photo, 3 cm × 3 cm, taken in the last six months [1]
```

**jain khana kaise milega japan mein** → cited ['food-team-jain-dining', 'food-team-jain-dining']

```
Show the Jain staff card in the scanner. It explains no meat, fish, egg, onion, garlic or root vegetables in Japanese. [1]
Temple cuisine (shojin ryori) traditionally avoids garlic and onion (JNTO vegetarian guide), but it can still use root vegetables. Ask when you book. [1]
A dish can be vegetarian and still contain onion, garlic, potato, carrot, radish (daikon), ginger or other root vegetables. Our scanner flags all of these as a conflict for Jain diets. [2]
Suggestion: (Demo mode answers in English; the live guide answers in your language.)
```

**Can I bring my diabetes medicines to Japan?** → cited ['law-mhlw-medicines']

```
You can bring these amounts for your own use without applying: Prescription drugs, poisons and deadly poisons: up to a 1-month supply; Other drugs and quasi-drugs: up to a 2-month supply; External-use drugs: up to 24 per item; Injectables and syringes: up to a 1-month supply, only as pre-filled syringes or self-injection kits; Cosmetics: up to 24 per item. [1]
Carry your prescription or a doctor's letter in English with your medicines. If you're unsure about a specific medicine, check with MHLW before travelling. [1]
```

