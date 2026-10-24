# Mitra Japan assistant: evaluation report

Generated 2026-10-24T17:22:54 · mode: **demo** · cases: 77

Thresholds were tuned on the **dev** split only; **held-out** numbers are the honest ones.
Groundedness here is a lexical check (≥60% of a cited fact's words appear in the cited chunk). It is
imperfect: it can't catch a fact that reuses the source's words with a wrong meaning. Run with `--judge`
in live mode for an LLM judge, and spot-check by hand (sample below).

| Metric | dev | held-out | all |
| --- | --- | --- | --- |
| hit@1 | 100% | 100% | 100% |
| hit@3 | 100% | 100% | 100% |
| hit@5 | 100% | 100% | 100% |
| mrr | 1.00 | 1.00 | 1.00 |
| citation_precision | 100% | 100% | 100% |
| groundedness | 100% | 100% | 100% |
| abstain_precision | 100% | 67% | 92% |
| abstain_recall | 100% | 100% | 100% |
| emergency_routing | 100% | 100% | 100% |
| patch_validity | 100% | 100% | 100% |
| unaffected_preserved | 100% | 100% | 100% |
| safety_checks | 100% | 100% | 100% |
| latency_p50_ms | 206.0 | 185 | 204 |
| latency_p95_ms | 375 | 287 | 356 |
| passed | 58 | 18 | 76 |
| cases | 58 | 19 | 77 |

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

**Do I need a visa for Japan with an Indian passport?** → cited ['visa-mofa-exemptions']

```
Japan has reciprocal visa-exemption arrangements with 74 countries and regions, listed on MOFA's "Exemption of Visa (Short-Term Stay)" page, dated September 1, 2025. [1]
India is not on that list. Indian nationals therefore need a visa even for a short-term stay such as tourism. For tourism, people residing in India can apply for JAPAN eVISA through an accredited agency; see the eVISA document. [1]
```

**How do I apply for a Japan tourist visa from India?** → cited ['visa-embassy-india']

```
Applications from India are submitted through VFS Global (the embassy's page says no prior appointment is needed). VFS site: https://visa.vfsglobal.com/ind/en/jpn/ [1]
The JAPAN eVISA system started for India on 1 April 2024 (see the MOFA eVISA document). [1]
```

**What is JAPAN eVISA and can people in India use it?** → cited ['visa-mofa-evisa', 'visa-mofa-evisa']

```
The Ministry of Foreign Affairs of Japan runs JAPAN eVISA, an online system for people who want to visit Japan for short-term tourism. Approved applicants receive an electronic visa instead of a visa sticker in the passport. [1]
People residing in India are listed among those who must apply through an accredited agency (the same group includes Hong Kong, Indonesia, Macau, Mongolia, the Republic of Korea, Singapore and the United Arab Emirates). Those exempt from short-term visas do not need it. [1]
Beware of fraudulent websites that look like the JAPAN eVISA site. [2]
```

**Can I show a screenshot of my eVISA at the airport?** → cited ['visa-mofa-evisa']

```
Travellers with an eVISA must show the "Visa issuance notice" on screen with an internet connection. The page states that a PDF, screenshot or printed copy is not accepted. [1]
Beware of fraudulent websites that look like the JAPAN eVISA site. [1]
```

**What is Visit Japan Web used for?** → cited ['visa-visit-japan-web']

```
Visit Japan Web is an official web service from Japan's Digital Agency. You use it to do arrival procedures online: immigration clearance and the customs declaration. Foreign visitors can also use it for tax-free shopping during their stay. [1]
Suspicious look-alike apps (for example one called "Visit Japan Web Info") have been reported. Use the official site. [1]
```

