import sqlite3
import unicodedata
from functools import lru_cache

from sqlalchemy import event
from sqlalchemy.engine import Engine


def fold_case(value: str | None) -> str:
    return unicodedata.normalize("NFKC", value or "").casefold()


def fold(value: str | None) -> str:
    normalized = fold_case(value)
    return " ".join(
        "".join(character if character.isalnum() else " " for character in normalized).split()
    )


@lru_cache(maxsize=512)
def parse_query(query: str) -> tuple[tuple[str, ...], str]:
    folded = fold(query)
    return tuple(folded.split()), fold_case(query)


def name_matches(title: str | None, folder_path: str | None, query: str) -> bool:
    words, literal = parse_query(query)
    combined = f"{title or ''} {folder_path or ''}"
    if words:
        haystack = fold(combined)
        return all(word in haystack for word in words)
    return literal in fold_case(combined)


# Listen on Engine so test-created engines receive the same functions as production.
@event.listens_for(Engine, "connect")
def _register_sqlite_functions(dbapi_conn, _connection_record) -> None:
    if not isinstance(dbapi_conn, sqlite3.Connection):
        return
    dbapi_conn.create_function(
        "name_search_match", 3, name_matches, deterministic=True
    )
    dbapi_conn.create_function(
        "name_search_casefold", 1, fold_case, deterministic=True
    )
