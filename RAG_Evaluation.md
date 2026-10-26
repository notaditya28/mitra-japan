# RAG Evaluation — Mitra Japan

## 1. Purpose

Mitra Japan's Retrieval-Augmented Generation (RAG) assistant retrieves relevant information from its knowledge base and uses it to answer travel-related questions. This document explains the evaluation results reported for the project and provides guidance for interpreting them.

## 2. Reported Evaluation Results

The project presentation reports these results:

| Test set | Passed | Total | Pass rate |
|---|---:|---:|---:|
| Development tests | 58 | 58 | 100% |
| Held-out tests | 18 | 19 | 94.7% |
| **Total** | **76** | **77** | **98.7%** |

Keep these figures in sync with the actual evaluation code and test data if either changes.

### What the two test sets mean

- **Development tests:** Cases used during development to check behaviour and help identify problems. Since developers may use these results to improve the system, passing these tests alone does not show how well it generalises to new cases.
- **Held-out tests:** A separate set reserved for evaluation. These provide a stronger check on cases not used to tune the system, provided they remained separate throughout development.

## 3. Reported Failure Example

The project presentation describes a held-out case involving a question about withdrawing cash using an Indian bank card. The assistant did not provide an answer because the knowledge base lacked a supporting ATM document.

Interpret this case using the expected outcome recorded for that test:

- If the expected behaviour was to avoid unsupported advice, abstaining may be the correct safety behaviour.
- If the test expected a supported answer and the assistant failed to retrieve the necessary source, it may count as a failure.

Check the test's actual pass/fail label before describing this example as either a successful abstention or a system error.

## 4. Recommended Evaluation Areas

The following are useful evaluation dimensions for Mitra Japan. They are **recommended categories**, not a claim that the current 77 tests cover every category.

| Evaluation area | What to check |
|---|---|
| Answer relevance | Does the response address the user's question? |
| Evidence support | Are important claims supported by retrieved source material? |
| Citation correctness | Do citations point to sources that support the claims? |
| Retrieval quality | Does retrieval find the relevant document or passage? |
| Abstention behaviour | Does the assistant say it cannot verify an answer when evidence is insufficient? |
| Freshness and source status | Does it avoid presenting stale or unverified information as current fact? |
| Language handling | Does it handle the languages and mixed-language inputs supported by the project? |
| Privacy handling | Is sensitive information handled according to the project's privacy requirements? |
| Itinerary changes | Do proposed changes match the user's request and preserve relevant constraints? |

## 5. How Test Cases Should Be Documented

For reproducibility, each evaluation case should ideally record:

1. **Case ID** — a stable identifier.
2. **User query** — the exact input sent to the assistant.
3. **Expected behaviour** — what a correct response or safe abstention should do.
4. **Relevant source** — the document or passage expected to support the answer, if applicable.
5. **Actual result** — the assistant's response and retrieved evidence.
6. **Outcome** — pass or fail according to a defined rule.
7. **Failure reason** — for example, retrieval miss, unsupported claim, incorrect citation, or incorrect abstention.

Do not mark a case as passed solely because the answer sounds plausible. Compare it with the expected behaviour and supporting evidence.

## 6. Interpreting the Results

The reported development result is 58/58, while the held-out result is 18/19. The held-out result is especially useful because it is intended to represent cases kept separate from development.

However, these percentages do not prove that the assistant is reliable for every real-world travel question. Interpretation depends on:

- how cases were selected;
- whether they cover realistic requests and important failure modes;
- whether expected outcomes were defined before testing;
- whether held-out cases remained separate from development;
- whether answers and citations were judged consistently.

A small test set can reveal useful problems, but it cannot guarantee that every future answer will be correct.

## 7. Reproducibility and Maintenance

When changing the RAG pipeline, knowledge base, prompts, retrieval settings, or ranking logic:

- rerun the development tests;
- evaluate against the held-out set without using it to tune the system;
- record the code/configuration version and evaluation date;
- document any changed expected outcomes;
- investigate failures before updating the reported figures.

If held-out cases are repeatedly used to make tuning decisions, they are no longer a fully independent final evaluation set. A new held-out set may then be needed for a stronger final check.

## 8. Current Documentation Limitations

The project presentation reports the totals and describes one held-out example, but those details alone do **not** establish:

- the exact process used to generate all 77 cases;
- the complete list of questions in each set;
- the precise pass/fail criteria;
- whether cases were written manually, generated automatically, or assembled using a mixture of methods;
- whether evaluation was fully automated or included human review.

Fill in these details only after checking the project's evaluation scripts and test data. Do not infer or invent them.

---

*This document describes the reported evaluation results and provides a framework for interpreting and maintaining them. Update it from the source evaluation files whenever the test suite or results change.*
