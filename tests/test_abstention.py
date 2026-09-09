"""Build-failing gates. Week 1: abstention only.

The first metric this harness enforces is not accuracy. It is whether the
assistant declines when the corpus cannot answer -- because an invented
answer to an unanswerable question is the defect class that ships silently.
"""
import json
import pathlib

import pytest

GOLDEN = pathlib.Path(__file__).parent.parent / "fixtures" / "golden.jsonl"


def load_golden():
    with GOLDEN.open() as fh:
        return [json.loads(line) for line in fh if line.strip()]


def test_golden_set_has_unanswerable_cases():
    """A golden set without unanswerable cases cannot detect invention."""
    cases = load_golden()
    unanswerable = [c for c in cases if not c["answerable"]]
    assert len(unanswerable) >= 1, "add at least one unanswerable case"
    assert len(unanswerable) / len(cases) >= 0.2, (
        "under 20% unanswerable cases: the suite will not catch confident invention"
    )


def test_every_case_is_labelled_by_a_human():
    for case in load_golden():
        assert case.get("labelled_by"), f"{case['id']} has no human label"


@pytest.mark.skip(reason="day 2: wire to the live SUT once the corpus is indexed")
def test_assistant_abstains_on_unanswerable():
    raise NotImplementedError
