"""Addendum 5 v3, milestone 1: diet rules, status engine, audit log, importer, seed and the planner filter."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text

from restaurants import db, demo, importer, rules, status
from restaurants.models import AppendOnlyError, AuditLog, DietStatus, Dish, DishDeclaration, Restaurant
from restaurants.rules import FULLY, NOT_SUITABLE, NOT_VERIFIED, PARTIAL
from verification import checks

NOW = datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc)
BOOK = rules.load()

GOOD = {
    "dish.broth": "kombu", "dish.meat_fish": ["none"], "dish.animal_fat": "none", "dish.sauce_bases": ["soy_sauce"],
    "dish.alcohol": ["none"], "dish.gelatin": "no", "dish.egg": "no", "dish.dairy": "no", "dish.honey": "no",
    "dish.onion_garlic": "no", "dish.root_vegetables": "no", "dish.ginger": "no", "dish.meat_slaughter": "not_applicable",
    "dish.modifiable": "no",
}
SEPARATE = {"kitchen.shared_fryer": "no", "kitchen.shared_grill": "no", "kitchen.shared_pan_oil": "no", "kitchen.separate_utensils": "yes"}
ALL_DIETS = tuple(BOOK.diets)


def facts(*dishes: dict, kitchen: dict | None = None, diets=ALL_DIETS, accepted=True, declared=NOW, contradictions=()) -> checks.RestaurantFacts:
    return checks.RestaurantFacts(
        diets_requested=tuple(diets),
        kitchen=dict(SEPARATE if kitchen is None else kitchen),
        dishes=tuple(checks.DishFacts(f"d{i}", f"Dish {i}", {**GOOD, **d}) for i, d in enumerate(dishes)),
        declaration_accepted=accepted,
        declared_at=declared,
        contradictions=tuple(contradictions),
    )


def st(f: checks.RestaurantFacts, diet: str, **kw) -> checks.CheckResult:
    return checks.evaluate(f, diet, BOOK, NOW, **kw)


# --- per-diet requirement matrix --------------------------------------------------------------


def test_a_fully_answered_plain_dish_is_only_restaurant_reported_for_every_diet():
    f = facts({})
    for diet in ALL_DIETS:
        r = st(f, diet)
        assert r.status == PARTIAL, (diet, r.missing_items)
        assert any("Restaurant-reported" in x for x in r.reasons)


def test_jain_requires_the_allium_and_root_answers():
    r = st(facts({"dish.onion_garlic": "unknown", "dish.root_vegetables": None}), "jain")
    assert r.status == NOT_VERIFIED
    assert any("onion" in m for m in r.missing_items) and any("root" in m for m in r.missing_items)
    # The same dish is fine for plain vegetarian: those questions aren't vegetarian rules.
    assert st(facts({"dish.onion_garlic": "unknown", "dish.root_vegetables": None}), "vegetarian").status == PARTIAL


def test_vegetarian_never_implies_jain():
    f = facts({"dish.onion_garlic": "yes"})
    assert st(f, "vegetarian").status == PARTIAL
    assert st(f, "jain").status == NOT_SUITABLE


def test_no_beef_never_implies_halal():
    f = facts({"dish.meat_fish": ["pork"], "dish.broth": "pork"})
    assert st(f, "no_beef").status == PARTIAL
    assert st(f, "halal").status == NOT_SUITABLE


def test_eggless_is_its_own_diet():
    f = facts({"dish.egg": "yes"})
    assert st(f, "vegetarian").status == PARTIAL
    assert st(f, "eggless").status == NOT_SUITABLE
    assert st(f, "vegan").status == NOT_SUITABLE


def test_missing_and_unknown_answers_give_not_verified():
    for answers in ({"dish.broth": "unknown"}, {"dish.broth": "other"}, {"dish.broth": None}, {"dish.gelatin": ""}):
        assert st(facts(answers), "vegetarian").status == NOT_VERIFIED, answers
    assert st(facts(kitchen={}), "vegetarian").status == NOT_VERIFIED
    assert st(facts({}, accepted=False), "vegetarian").status == NOT_VERIFIED
    assert st(facts(), "vegetarian").status == NOT_VERIFIED  # no dishes


def test_hidden_fish_and_curry_roux():
    assert st(facts({"dish.broth": "bonito"}), "vegetarian").status == NOT_SUITABLE
    assert st(facts({"dish.sauce_bases": ["soy_sauce", "bonito_dashi"]}), "vegetarian").status == NOT_SUITABLE
    roux = facts({"dish.sauce_bases": ["curry_roux"]})
    assert st(roux, "vegetarian").status == NOT_VERIFIED
    assert st(roux, "no_beef").status == NOT_VERIFIED
    assert st(roux, "eggless").status == PARTIAL


def test_halal_alcohol_slaughter_and_shared_kitchen():
    assert st(facts({"dish.alcohol": ["mirin"]}), "halal").status == NOT_SUITABLE
    chicken = {"dish.meat_fish": ["chicken"], "dish.broth": "chicken"}
    assert st(facts({**chicken, "dish.meat_slaughter": "halal_certified"}), "halal").status == PARTIAL
    assert st(facts({**chicken, "dish.meat_slaughter": "not_halal"}), "halal").status == NOT_SUITABLE
    assert st(facts({**chicken, "dish.meat_slaughter": "unknown"}), "halal").status == NOT_VERIFIED
    shared = {"kitchen.shared_fryer": "yes", "kitchen.shared_grill": "no", "kitchen.shared_pan_oil": "no"}
    assert st(facts({}, kitchen={**shared, "kitchen.separate_utensils": "yes"}), "halal").status == PARTIAL
    assert st(facts({}, kitchen={**shared, "kitchen.separate_utensils": "no"}), "halal").status == NOT_SUITABLE
    unsure = st(facts({}, kitchen={**shared, "kitchen.separate_utensils": "unknown"}), "halal")
    assert unsure.status == NOT_VERIFIED and any("separate" in m for m in unsure.missing_items)
    # A shared fryer is only a caution for vegetarian, and it is shown.
    veg = st(facts({}, kitchen={**shared, "kitchen.separate_utensils": "no"}), "vegetarian")
    assert veg.status == PARTIAL and any("cross-contact" in x for x in veg.reasons)


def test_modifiable_conflicts_need_the_restaurant_to_say_so():
    assert st(facts({"dish.onion_garlic": "yes", "dish.modifiable": "no"}), "jain").status == NOT_SUITABLE
    r = st(facts({"dish.onion_garlic": "yes", "dish.modifiable": "yes"}), "jain")
    assert r.status == PARTIAL and any("leave out" in x for x in r.reasons)
    # A broth can't be left out.
    assert st(facts({"dish.broth": "bonito", "dish.modifiable": "yes"}), "vegetarian").status == NOT_SUITABLE


def test_jain_ginger_follows_the_strictness_profile():
    f = facts({"dish.ginger": "yes"})
    assert st(f, "jain").status == NOT_SUITABLE
    assert st(f, "jain", profile="flexible").status == PARTIAL


def test_one_unsuitable_dish_does_not_sink_a_suitable_one():
    r = st(facts({}, {"dish.broth": "bonito"}), "vegetarian")
    assert r.status == PARTIAL and r.suitable_dish_ids == ["d0"]
    assert st(facts({"dish.broth": "bonito"}, {"dish.broth": "pork"}), "vegetarian").status == NOT_SUITABLE


def test_unassessed_diets_and_stale_answers():
    assert st(facts({}, diets=("vegan",)), "jain").status == NOT_VERIFIED
    assert st(facts({}, declared=NOW - timedelta(days=400)), "vegan").status == NOT_VERIFIED


def test_contradictions_block_anything_above_not_verified():
    c = {"id": "c1", "diets": ["vegetarian", "vegan"], "field": "dish.broth", "declared": "kombu", "found": "bonito", "source": "menu photo", "resolved": False}
    assert st(facts({}, contradictions=[c]), "vegetarian").status == NOT_VERIFIED
    assert st(facts({}, contradictions=[c]), "halal").status == PARTIAL
    assert st(facts({}, contradictions=[{**c, "resolved": True}]), "vegetarian").status == PARTIAL


def test_automation_never_reaches_fully_verified():
    rng = random.Random(7)
    for _ in range(3000):
        answers = {f: rng.choice([*spec["values"], None]) for f, spec in BOOK.fields.items() if f.startswith("dish.")}
        for f, spec in BOOK.fields.items():
            if spec["kind"] == "many" and isinstance(answers.get(f), str):
                answers[f] = [answers[f]]
        kitchen = {f: rng.choice([*spec["values"], None]) for f, spec in BOOK.fields.items() if f.startswith("kitchen.")}
        f = facts(answers, kitchen=kitchen, accepted=rng.random() > 0.1)
        for diet in ALL_DIETS:
            assert st(f, diet).status in (PARTIAL, NOT_VERIFIED, NOT_SUITABLE)


def test_rules_file_is_marked_for_review_and_diets_match():
    assert BOOK.status == "needs-review"
    assert set(BOOK.diets) == {"jain", "vegetarian", "vegan", "halal", "no_beef", "eggless"}


# --- database: status engine, audit log, importer, seed ---------------------------------------


@pytest.fixture()
def session(tmp_path):
    url = f"sqlite:///{(tmp_path / 'r.db').as_posix()}"
    db.migrate(url)
    s = db.session_factory(url)()
    yield s
    s.close()


def add_restaurant(s, *, origin="real", diets=("jain", "vegetarian"), dishes=({},), kitchen=None) -> Restaurant:
    r = Restaurant(
        id=f"r{random.randrange(10**9)}",
        name_en="Test kitchen",
        city_id="kyoto",
        lat=35.0,
        lng=135.7,
        diets_requested=list(diets),
        kitchen=dict(SEPARATE if kitchen is None else kitchen),
        declaration_accepted=True,
        declared_at=NOW,
        data_origin=origin,
    )
    for i, d in enumerate(dishes):
        dish = Dish(name_en=f"Dish {i}", position=i)
        dish.declarations.append(DishDeclaration(answers={**GOOD, **d}))
        r.dishes.append(dish)
    s.add(r)
    s.flush()
    status.recompute(s, r, now=NOW)
    return r


def by_diet(r: Restaurant) -> dict[str, DietStatus]:
    return {ds.diet: ds for ds in r.statuses}


def verify(s, r, diet="jain", **kw):
    ev = status.evidence_reference(s, r, "Phone call with the chef")
    args = dict(method="phone", initials="AB", dish_ids=[r.dishes[0].id], evidence_ids=[ev.id], now=NOW, mode="production")
    args.update(kw)
    return status.verify(s, r.id, diet, **args)


def test_audit_log_is_append_only_in_the_orm_and_the_database(session):
    status.audit(session, actor="system", reason="test", now=NOW)
    session.flush()
    row = session.scalars(select(AuditLog)).first()
    row.reason = "changed"
    with pytest.raises(AppendOnlyError):
        session.flush()
    session.rollback()
    status.audit(session, actor="system", reason="test", now=NOW)
    session.commit()
    for sql in ("UPDATE audit_log SET reason='x'", "DELETE FROM audit_log"):
        with pytest.raises(Exception, match="append-only"):
            session.execute(text(sql))
        session.rollback()


def test_only_a_verifier_action_sets_fully_verified(session):
    r = add_restaurant(session)
    assert by_diet(r)["jain"].status == PARTIAL
    ds = verify(session, r)
    assert ds.status == FULLY and ds.verifier_initials == "AB" and ds.verified_dish_ids == [r.dishes[0].id]
    assert ds.expires_at and status.aware(ds.expires_at) > NOW + timedelta(days=170)
    log = session.scalars(select(AuditLog).where(AuditLog.to_status == FULLY)).all()
    assert log and log[-1].actor == "verifier:AB"
    # Re-checking doesn't take it away while nothing changed.
    status.recompute(session, r, now=NOW + timedelta(days=1))
    assert by_diet(r)["jain"].status == FULLY


@pytest.mark.parametrize(
    "change, problem",
    [
        ({"method": "email"}, "Method"),
        ({"initials": "x"}, "initials"),
        ({"dish_ids": []}, "at least one dish"),
        ({"evidence_ids": []}, "evidence"),
    ],
)
def test_verify_refuses_incomplete_records(session, change, problem):
    r = add_restaurant(session)
    with pytest.raises(status.VerificationError, match=problem):
        verify(session, r, **change)


def test_verify_refuses_unsuitable_unanswered_or_contradicted_listings(session):
    r = add_restaurant(session, dishes=({"dish.onion_garlic": "yes"},))
    with pytest.raises(status.VerificationError, match="conflict"):
        verify(session, r)
    r2 = add_restaurant(session, dishes=({"dish.root_vegetables": "unknown"},))
    with pytest.raises(status.VerificationError, match="missing answers"):
        verify(session, r2)
    r3 = add_restaurant(session)
    r3.contradictions = [{"id": "c", "diets": ["jain"], "declared": "no garlic", "found": "garlic", "source": "menu", "resolved": False}]
    with pytest.raises(status.VerificationError, match="contradiction"):
        verify(session, r3)


def test_production_never_verifies_sample_data_and_demo_is_labelled(session):
    sample = add_restaurant(session, origin="sample")
    with pytest.raises(status.VerificationError, match="Sample records"):
        verify(session, sample)
    ds = verify(session, sample, mode="demo")
    assert ds.demo and status.traveller_label(ds, mode="demo").label == "Fully verified (DEMO)"
    assert status.recommendable(ds, now=NOW, mode="demo")
    assert not status.recommendable(ds, now=NOW, mode="production")
    assert status.traveller_label(ds, mode="production").status == NOT_VERIFIED


def test_expiry_downgrades_and_is_audited(session):
    r = add_restaurant(session)
    verify(session, r, expiry_months=1)
    later = NOW + timedelta(days=40)
    assert not status.recommendable(by_diet(r)["jain"], now=later, mode="production")
    assert status.refresh_expired(session, later) == 1
    assert by_diet(r)["jain"].status == PARTIAL
    assert session.scalars(select(AuditLog).where(AuditLog.reason.like("Verification expired%"))).first()


def test_an_edit_that_touches_the_diet_downgrades_but_others_do_not(session):
    r = add_restaurant(session)
    verify(session, r)
    dish = r.dishes[0]
    dish.declarations.append(DishDeclaration(answers={**dish.answers, "dish.dairy": "yes"}, created_at=NOW + timedelta(seconds=1)))
    status.recompute(session, r, now=NOW + timedelta(minutes=1))
    assert by_diet(r)["jain"].status == FULLY  # Jain rules don't read dairy
    dish.declarations.append(DishDeclaration(answers={**dish.answers, "dish.ginger": "unknown"}, created_at=NOW + timedelta(seconds=2)))
    status.recompute(session, r, now=NOW + timedelta(minutes=2))
    jain = by_diet(r)["jain"]
    assert jain.status == NOT_VERIFIED and jain.verification_id is None
    entry = session.scalars(select(AuditLog).where(AuditLog.diet == "jain", AuditLog.from_status == FULLY)).one()
    assert entry.reason == "Answers that affect this diet changed after verification"


def test_reports_pause_and_staff_confirmation_never_upgrades(session):
    r = add_restaurant(session)
    verify(session, r)
    status.report(session, r.id, kind="staff_confirmed", diet="vegetarian", now=NOW)
    assert by_diet(r)["vegetarian"].status == PARTIAL and not by_diet(r)["vegetarian"].paused
    rep = status.report(session, r.id, kind="report", diet="jain", message="Garlic in the curry", now=NOW)
    jain = by_diet(r)["jain"]
    assert jain.paused and status.traveller_label(jain).label == "Under review"
    assert not status.recommendable(jain, now=NOW, mode="production")
    status.resolve_report(session, rep.id, resolution="Checked with the kitchen", actor="verifier:AB", now=NOW)
    assert not by_diet(r)["jain"].paused


def test_planner_filter_needs_every_diet_in_the_trip(session):
    r = add_restaurant(session, diets=("jain", "vegetarian", "vegan"))
    verify(session, r, "jain")
    assert status.meal_eligible(r, ["jain"], now=NOW, mode="production")
    assert not status.meal_eligible(r, ["jain", "vegetarian"], now=NOW, mode="production")
    verify(session, r, "vegetarian")
    assert status.meal_eligible(r, ["jain", "vegetarian"], now=NOW, mode="production")
    assert not status.meal_eligible(r, [], now=NOW, mode="production")
    status.remove_listing(session, r, actor="restaurant", now=NOW)
    assert not status.meal_eligible(r, ["jain"], now=NOW, mode="production")


def test_planner_filter_has_zero_violations_on_generated_trips():
    rng = random.Random(42)
    violations = 0
    for _ in range(20000):
        statuses = []
        for diet in ALL_DIETS:
            if rng.random() < 0.2:
                continue
            statuses.append(
                DietStatus(
                    diet=diet,
                    status=rng.choice([FULLY, FULLY, PARTIAL, NOT_VERIFIED, NOT_SUITABLE]),
                    paused=rng.random() < 0.15,
                    expires_at=NOW + timedelta(days=rng.randint(-30, 200)) if rng.random() > 0.05 else None,
                    verified_dish_ids=["d"] if rng.random() > 0.1 else [],
                    data_origin=rng.choice(["real", "sample"]),
                    demo=rng.random() < 0.3,
                )
            )
        r = Restaurant(id="x", city_id="kyoto", data_origin="real", statuses=statuses)
        trip = rng.sample(ALL_DIETS, rng.randint(1, 3))
        mode = rng.choice(["demo", "production"])
        if status.meal_eligible(r, trip, now=NOW, mode=mode):
            got = {ds.diet: ds for ds in statuses}
            for d in trip:
                ds = got.get(d)
                ok = (
                    ds is not None
                    and ds.status == FULLY
                    and not ds.paused
                    and ds.expires_at is not None
                    and status.aware(ds.expires_at) > NOW
                    and ds.verified_dish_ids
                    and (mode == "demo" or (ds.data_origin == "real" and not ds.demo))
                )
                violations += not ok
    assert violations == 0


def test_importer_refuses_unproven_verifications(session):
    base = {
        "id": "imp-1", "nameEn": "Imported", "cityId": "tokyo", "dataOrigin": "real", "dietsRequested": ["vegetarian"],
        "kitchen": SEPARATE, "declaration": {"accepted": True, "declaredAt": "2026-10-20T00:00:00+00:00"},
        "dishes": [{"id": "imp-d1", "nameEn": "Soba", "answers": GOOD}],
    }
    good = {"diet": "vegetarian", "method": "visit", "verifiedAt": "2026-10-21T00:00:00+00:00", "verifierInitials": "CD", "evidence": ["Visit notes"], "dishIds": ["imp-d1"]}
    missing = [{**good, "evidence": []}, {**good, "method": ""}, {**good, "verifierInitials": None}, {**good, "verifiedAt": None}]
    rep = importer.import_records(session, [{**base, "verifications": missing}], mode="production", now=NOW)
    assert rep.imported == ["imp-1"] and not rep.verified and len(rep.refused) == 4
    assert session.get(Restaurant, "imp-1").statuses[0].status == PARTIAL
    rep2 = importer.import_records(session, [{**base, "id": "imp-2", "dishes": [{"id": "imp-d2", "nameEn": "Soba", "answers": GOOD}], "verifications": [{**good, "dishIds": ["imp-d2"]}]}], mode="production", now=NOW)
    assert rep2.verified == [("imp-2", "vegetarian")]
    sample = {**base, "id": "imp-3", "dataOrigin": "sample", "dishes": [{"id": "imp-d3", "nameEn": "Soba", "answers": GOOD}], "verifications": [{**good, "dishIds": ["imp-d3"]}]}
    rep3 = importer.import_records(session, [sample], mode="production", now=NOW)
    assert not rep3.verified and "never be fully verified in production" in rep3.refused[0][2][0]
    now_on_real = {**base, "id": "imp-4", "declaration": {"accepted": True, "declaredAt": "@now"}}
    assert importer.import_records(session, [now_on_real], mode="demo", now=NOW).refused
    assert importer.import_records(session, [base], mode="demo", now=NOW).refused[0][2] == ["already exists"]


def test_demo_reset_restores_the_seed_and_keeps_the_audit_history(session):
    rep = demo.reset_demo(session, now=NOW)
    assert len(rep.imported) == 24 and not rep.refused
    samples = session.scalars(select(Restaurant).where(Restaurant.data_origin == "sample")).all()
    real = session.scalars(select(Restaurant).where(Restaurant.data_origin == "real")).all()
    assert 10 <= len(samples) <= 20 and {r.city_id for r in samples} == {"tokyo", "kyoto", "osaka"}
    assert all(r.display_name.startswith("Sample") for r in samples)
    for r in real:
        assert all(ds.status == NOT_VERIFIED for ds in r.statuses), r.id
    for ds in (ds for r in samples for ds in r.statuses if ds.status == FULLY):
        assert ds.demo, "every seeded verification is a DEMO verification"
    # Kyoto's Jain gap: nothing near Arashiyama is verified for Jain.
    arashiyama = session.get(Restaurant, "sample-arashiyama-tofu")
    assert "jain" not in by_diet(arashiyama)
    audit_before = session.scalar(select(text("count(*)")).select_from(AuditLog))
    session.add(Restaurant(id="judge-entry", name_en="Anything", city_id="kyoto", data_origin="sample"))
    session.flush()
    demo.reset_demo(session, now=NOW)
    assert session.get(Restaurant, "judge-entry") is None
    assert session.scalar(select(text("count(*)")).select_from(Restaurant)) == 24
    assert session.scalar(select(text("count(*)")).select_from(AuditLog)) > audit_before
    with pytest.raises(PermissionError):
        demo.reset_demo(session, mode="production")


def test_removal_deletes_contacts_and_hides_the_listing(session):
    from restaurants.models import Contact

    r = add_restaurant(session)
    r.contacts.append(Contact(name="Owner", phone="000", consent=True))
    session.flush()
    status.remove_listing(session, r, actor="restaurant", now=NOW)
    session.flush()
    assert r.removed_at is not None and not session.scalars(select(Contact)).all()


def test_typescript_diet_ids_match_the_shared_json():
    import re

    from app.config import settings

    ts = (settings.shared_dir / "src" / "index.ts").read_text(encoding="utf-8")
    listed = re.search(r"DIET_IDS = \[(.*?)\] as const", ts, re.S)
    assert listed and re.findall(r"'([a-z_]+)'", listed.group(1)) == list(BOOK.diets)
