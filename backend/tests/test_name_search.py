import importlib

import pytest
from sqlalchemy import create_engine


def _name_search():
    try:
        return importlib.import_module("app.services.name_search")
    except ModuleNotFoundError:
        pytest.fail("app.services.name_search is not implemented")


@pytest.mark.parametrize(
    ("title", "folder_path", "query", "expected"),
    [
        ("Самые ЧАСТЫЕ ОШИБКИ", "", "самые частые ошибки", True),
        ("Planning HOUSE", "", "planning house", True),
        ("Проект HOUSE", "", "проект house", True),
        ("Straße alpha", "", "ALPHA STRASSE", True),
        ("  alpha   beta  ", "", " alpha beta ", True),
        ("alpha\u00a0beta", "", "alpha\tbeta", True),
        ("alpha—beta|gamma_delta", "", "delta beta alpha", True),
        ("alpha beta", "", "alpha-beta", True),
        ("one two three", "", "three one", True),
        ("планировках", "", "планиров", True),
        ("Notes #archive", "", "#", True),
        ("Ｆｕｌｌ　Ｗｉｄｔｈ", "", "full width", True),
        ("旅行のメモ", "", "旅行", True),
        ("House plans", "architect/Vitaly", "vitaly plans", True),
        ("Cafe\u0301", "", "café", True),
        ("a\u0323\u0301", "", "\u0301\u0323", True),
        ("CAFE\u0301", "", "cafe", True),
        ("alpha 3", "", "alpha 2", False),
        ("House plans", "architect/Vitaly", "garden plans", False),
    ],
)
def test_name_match_table(title, folder_path, query, expected):
    assert _name_search().name_matches(title, folder_path, query) is expected


@pytest.mark.parametrize(
    "title",
    [
        "Самые ЧАСТЫЕ ОШИБКИ",
        "alpha—beta_gamma",
        "Cafe\u0301",
        "旅行のメモ",
    ],
)
def test_every_contiguous_title_substring_still_matches(title):
    name_matches = _name_search().name_matches

    for start in range(len(title)):
        for end in range(start + 1, len(title) + 1):
            assert name_matches(title, "", title[start:end]), (start, end)


def test_tag_fold_keeps_punctuation():
    fold_case = _name_search().fold_case

    assert fold_case("ДОМ") == fold_case("дом")
    assert fold_case("c++") != fold_case("c")


def test_sqlite_functions_are_registered_on_new_engines():
    _name_search()
    engine = create_engine("sqlite://")

    with engine.connect() as connection:
        row = connection.exec_driver_sql(
            "SELECT name_search_match(?, ?, ?), name_search_casefold(?)",
            ("Самые ЧАСТЫЕ", "", "самые частые", "ДОМ"),
        ).one()

    assert row == (1, "дом")
