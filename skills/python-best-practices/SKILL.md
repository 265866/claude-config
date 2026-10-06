---
name: python-best-practices
description: Python best practices. Use when reading or editing any .py file.
paths: ["**/*.py"]
---

# Python best practices

Apply the **principle-type-system-discipline** principle skill first.

Check `requires-python` in pyproject.toml before applying version-gated syntax: PEP 695 needs 3.12; `StrEnum`, `TaskGroup`, `asyncio.timeout`, `except*`, and `assert_never` need 3.11. On older floors use the pre-695 equivalents (`TypeVar`, `TypeAlias`).

| Rule | Summary |
|------|---------|
| Modern annotations | `X \| None`, `list[str]`, `def f[T](...)`, `type Alias = ...`. No `Optional`, `Union`, `List`, or module-level `TypeVar` in new code. |
| Tagged unions | Model variants as a union of frozen dataclasses dispatched with `match` plus `assert_never`. No optional-field bags, no `kind` string checked with `if`. |
| Domain primitives | `NewType` for ids and units so they can't be mixed up; `Enum`/`StrEnum` for closed sets of values. Validate once at creation. |
| Dataclasses over dicts | `@dataclass(frozen=True, slots=True)` for data that crosses a function boundary. No dict-passing, no hand-written `__init__`/`__eq__`/`__repr__`. Use attrs for validators or converters when the project already depends on it. Add it only when its validators or converters earn a new dependency, and report it. |
| Boundary validation | Parse external data once at the edge and trust types inside. Use pydantic (`model_validate`, `TypeAdapter`) when the project already depends on it; otherwise a `TypedDict` or dataclass plus one checking function. Add pydantic only when the boundary earns a new dependency, and report it. No re-validation or `isinstance` checks deep in call chains. See the **principle-boundary-discipline** principle skill. |
| `Any` and `cast` discipline | External data enters as parsed types, never `Any`. `cast()` is an unchecked assertion earned only after validation. `# type: ignore` needs an error code and a reason. `TypeGuard` for narrowing helpers. |
| Parameter variance | Accept the widest read-only protocol needed (`Iterable`, `Sequence`, `Mapping`); return concrete types. `list[Derived]` is not `list[Base]`. |
| Narrow exceptions | Catch the specific type at the level that can respond, chain with `raise ... from e`, otherwise let it propagate. Never bare `except:` or blanket `except Exception` that swallows. |
| Context managers | Every acquire/release pair goes through `with`: files, locks, connections, subprocesses. `@contextmanager` for your own, `ExitStack` for dynamic counts. |
| Structured concurrency | `asyncio.TaskGroup`, never bare fire-and-forget `create_task`. `asyncio.timeout` for deadlines, `except*` for the resulting `ExceptionGroup`. |
| Generators | Yield instead of accumulating a list when data is consumed once or is large. Return a list when the caller needs `len`, indexing, or reuse. |
| pathlib | `Path` and its methods over `os.path` and bare `open`. Always pass `encoding=` for text. |
| `match` for structure | Use `match` when dispatching on shape or variant with destructuring. Keep `if`/`elif` for plain boolean conditions. |
| Comprehension restraint | One clause, one condition, readable on one or two lines. Anything denser becomes a loop or a named helper. |
| Protocols | Define a `Protocol` at the consumer with only the methods it uses; providers conform structurally and import nothing. Skip it when there's one concrete provider and no boundary or import cycle. |
| No mutable defaults | Default arguments are evaluated once. Use `None` sentinel or `field(default_factory=...)`. |
| No util dumps | Name modules after the domain concept they own (`pricing.py`, `retry.py`). No `utils.py`, `helpers.py`, `common.py`. |
| Logging with context | Module-level `logging.getLogger(__name__)`, lazy `%s` args, ids in `extra=`, `logger.exception` in handlers. No `print` for diagnostics in library or service code; a CLI printing its actual output to stdout is fine. |

Examples: [references/patterns.md](${CLAUDE_SKILL_DIR}/references/patterns.md).
