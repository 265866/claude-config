# Python patterns

Code examples for each rule in `SKILL.md`. The underlying principles are language-agnostic. See the **principle-type-system-discipline** and **principle-boundary-discipline** principle skills. Everything targets Python 3.12+.

## Modern annotations

PEP 604 unions, builtin generics, PEP 695 type parameters and aliases. The old spellings are noise.

```python
# Don't
from typing import Dict, List, Optional, TypeVar, Generic

T = TypeVar("T")

def first(items: List[T]) -> Optional[T]: ...

class Stack(Generic[T]): ...

# Do
def first[T](items: list[T]) -> T | None: ...

class Stack[T]: ...

type Pair[T] = tuple[T, T]
```

Bounds and constraints go inline: `def largest[T: (int, float)](xs: list[T]) -> T`, `class Repo[M: Model]`. Reach for `TypeVar` only when a library still requires it.

## Tagged unions

If a bug forces the question "can this combination actually happen?", the type is too loose. Model variants as a union of frozen dataclasses; each state carries exactly the fields that exist in that state.

```python
# Don't. Optionals let contradictory states exist.
@dataclass
class DiffState:
    loading: bool
    diff: Diff | None = None
    error: str | None = None

# Do. Only valid states exist.
@dataclass(frozen=True, slots=True)
class Loading: ...

@dataclass(frozen=True, slots=True)
class Ready:
    diff: Diff

@dataclass(frozen=True, slots=True)
class Failed:
    error: str

type DiffState = Loading | Ready | Failed
```

Dispatch with `match` and make it exhaustive; `assert_never` errors at type-check time when a variant is added and at runtime if one slips through:

```python
from typing import assert_never

match state:
    case Loading():
        render_spinner()
    case Ready(diff=diff):
        render(diff)
    case Failed(error=error):
        render_error(error)
    case _:
        assert_never(state)
```

A `type` alias is a `TypeAliasType`, not a class: `isinstance(x, DiffState)` raises `TypeError`. Match on the variant classes.

## Domain primitives

`NewType` makes ids distinct to the type checker with no wrapper object and no attribute indirection; `AccountId(raw)` is an identity call. Validate once where the value is created; downstream code trusts the type.

```python
# Don't. Swap the arguments, still type-checks.
def transfer(source: str, dest: str, amount: int) -> None: ...

# Do
from typing import NewType

AccountId = NewType("AccountId", str)
Cents = NewType("Cents", int)

def parse_account_id(raw: str) -> AccountId:
    if not ACCOUNT_RE.fullmatch(raw):
        raise ValueError(f"invalid account id: {raw!r}")
    return AccountId(raw)

def transfer(source: AccountId, dest: AccountId, amount: Cents) -> None: ...
```

NewType over numbers degrades under arithmetic: `Cents + Cents` is plain `int`. When units must survive math, wrap them in a dataclass instead.

Closed sets of values are enums, not strings:

```python
from enum import StrEnum

class Currency(StrEnum):
    USD = "usd"
    EUR = "eur"
```

A small closed set that doesn't warrant an `Enum` can be a `Literal["asc", "desc"]`.

## Dataclasses over dicts

A dict crossing a function boundary is an untyped bag: no completion, no rename, typos become `KeyError` at runtime.

```python
# Don't
def create_order(data: dict) -> dict:
    return {"id": new_id(), "sku": data["sku"], "qty": data.get("qty", 1)}

# Do
@dataclass(frozen=True, slots=True)
class Order:
    id: OrderId
    sku: Sku
    qty: int = 1
```

Defaults: `frozen=True` unless mutation is the point, `slots=True` for memory and typo-proofing, `kw_only=True` when there are several same-typed fields. Drop `slots=True` where it bites: it breaks zero-arg `super()` before Python 3.14 and `@cached_property` on every version, and a slotted dataclass inheriting a non-slotted base still gets a `__dict__`, so it buys nothing. Never hand-write `__init__`, `__eq__`, or `__repr__` for a data-shaped class. attrs adds what stdlib dataclasses lack (validators, converters, `__init__` hooks); it's a new dependency, so ask first unless the project already uses it.

## Boundary validation

Parse external data once where it enters; inside, types are the proof. External means HTTP bodies, `json.loads`, subprocess output, files, environment, database rows.

```python
# Don't. Every layer re-checks because none of them trusts the data.
def settle(payment: dict) -> None:
    if "amount" not in payment or not isinstance(payment["amount"], int):
        raise ValueError("bad payment")
    ...

# Do. One parse at the edge produces a typed object.
from pydantic import BaseModel

class Payment(BaseModel):
    id: PaymentId
    amount_cents: int
    currency: Currency

def settle(payment: Payment) -> None: ...  # trusts the type

settle(Payment.model_validate_json(body))  # edge
```

`model_validate_json` parses raw JSON bytes; `model_validate` takes an already-decoded object, e.g. `Payment.model_validate(row)` for a database row. `TypeAdapter` validates non-model shapes: `TypeAdapter(list[Payment]).validate_json(body)`. When the edge is thin and pydantic isn't already in the project, a `TypedDict` plus one checking function does the same job. Do not re-validate deep in call chains.

## `Any` and `cast` discipline

`Any` disables checking for everything it touches and spreads through inference. External data enters as parsed types (see Boundary validation), never `Any`.

```python
# Don't. Any spreads; cast asserts and checks nothing.
import json
from typing import Any, cast

def handle(body: bytes) -> None:
    data: Any = json.loads(body)
    user = cast(User, data)  # wrong shape crashes far from here
    ...

# Do. Parse at the edge; no Any, no cast.
def handle(body: bytes) -> None:
    user = User.model_validate_json(body)
    ...
```

`cast()` is an unchecked assertion: earn it only after a check the type system can't see, and prefer restructuring so it isn't needed. `# type: ignore` always carries an error code and a reason: `# type: ignore[union-attr]  # stub bug in libfoo 2.3`. Narrowing helpers return `TypeGuard` and must actually verify the claim; a lying guard hides the bug behind a name that says it's safe.

```python
from typing import TypeGuard

def is_str_list(xs: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in xs)
```

## Parameter variance

`list` and `dict` are invariant: `list[AdminUser]` is not a `list[User]`, and the checker rejects the call. Accept the widest read-only protocol the function needs; return concrete types so callers keep the full API.

```python
# Don't. A list[AdminUser] argument is rejected.
def emails(users: list[User]) -> list[str]:
    return [u.email for u in users]

# Do. Sequence is covariant and read-only; list, tuple, and subclass elements all fit.
from collections.abc import Sequence

def emails(users: Sequence[User]) -> list[str]:
    return [u.email for u in users]
```

`Iterable` when you only loop once, `Sequence` when you need `len` or indexing, `Mapping` for read-only dict access, all from `collections.abc`. Take a mutable type (`list`, `dict`, `MutableMapping`) only when the function mutates it; the signature then says so.

## Narrow exceptions

Catch the specific exception at the level that can actually respond. Everything else propagates; a stack trace at the top beats a swallowed error in the middle.

```python
# Don't. Catches typos (NameError, AttributeError) and real bugs alike, then hides them.
try:
    config = load_config(path)
except Exception:
    logger.error("config failed")
    config = {}

# Do. Specific types; a missing file has a defined meaning here, malformed input becomes a chained domain error.
try:
    raw = tomllib.loads(path.read_text(encoding="utf-8"))
except FileNotFoundError:
    raw = {}
except tomllib.TOMLDecodeError as e:
    raise ConfigError(f"invalid config at {path}") from e
```

`from e` preserves the cause in the traceback; `from None` deliberately hides an implementation detail. Bare `except:` also traps `KeyboardInterrupt` and `SystemExit`; never write it.

## Context managers

Every acquire/release pair goes through `with`; an early `return` or exception can skip a manual `close()`.

```python
# Don't
f = open(path, encoding="utf-8")
data = f.read()
f.close()

# Do
with path.open(encoding="utf-8") as f:
    data = f.read()
```

Own resources get `@contextmanager`; the `finally` guarantees release:

```python
from collections.abc import Iterator
from contextlib import contextmanager

@contextmanager
def advisory_lock(conn: Connection, key: int) -> Iterator[None]:
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

A dynamic number of resources is `ExitStack`:

```python
from contextlib import ExitStack

with ExitStack() as stack:
    files = [stack.enter_context(p.open(encoding="utf-8")) for p in paths]
```

## Structured concurrency

The event loop holds only weak references to tasks: a bare `create_task` result can be garbage collected mid-flight, and its exception vanishes. `TaskGroup` owns its tasks, waits for all of them, and cancels siblings when one fails.

```python
# Don't. Fire-and-forget: results dropped, errors silent, task may be GC'd.
for url in urls:
    asyncio.create_task(fetch(url))

# Do. All complete or the group raises.
import asyncio

async with asyncio.TaskGroup() as tg:
    tasks = [tg.create_task(fetch(url)) for url in urls]
results = [t.result() for t in tasks]
```

Failures arrive as an `ExceptionGroup`; handle classes of them with `except*`:

```python
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(fetch(a))
        tg.create_task(fetch(b))
except* httpx.HTTPError as eg:
    for e in eg.exceptions:
        logger.error("fetch failed", exc_info=e)
```

Sub-exceptions can themselves be groups (nested TaskGroups nest them); the flat loop handles a single level.

Prefer `asyncio.timeout` for a scoped deadline over threading timeout arguments through the call chain; `asyncio.wait_for` is fine for a single awaitable. `TimeoutError` is catchable only outside the block:

```python
try:
    async with asyncio.timeout(10):
        await sync_all()
except TimeoutError:
    logger.warning("sync timed out")
```

A genuinely long-lived background task gets a strong reference and a done-callback, not a bare `create_task`.

## Generators

When data is consumed once, accumulating a list buys peak memory and latency for nothing.

```python
# Don't. Materializes every row before the first one is processed.
def read_records(path: Path) -> list[Record]:
    out = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            out.append(parse(line))
    return out

# Do. Constant memory, first result immediately.
from collections.abc import Iterator

def read_records(path: Path) -> Iterator[Record]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            yield parse(line)
```

Generator expressions feed reducers without an intermediate list: `sum(r.amount for r in records)`. Return a list when the caller needs `len`, indexing, or multiple passes; a generator there just forces `list()` at the call site.

## pathlib

`Path` composes with `/`, carries its methods, and types as a path instead of a string.

```python
# Don't
import os

with open(os.path.join(base, "logs", name + ".log")) as f:
    data = f.read()

# Do
data = (base / "logs" / f"{name}.log").read_text(encoding="utf-8")
```

`p.exists()`, `p.mkdir(parents=True, exist_ok=True)`, `p.glob("**/*.py")`, `p.suffix`, `p.stem` replace the `os.path` zoo. Always pass `encoding=` for text; the platform default is not UTF-8 everywhere.

## `match` for structure

`match` earns its keep when you dispatch on shape and destructure in the same step: unions, tuples, nested data. A boolean condition is still `if`.

```python
# Don't. Manual type checks plus manual field access.
if isinstance(cmd, Move):
    go(cmd.x, cmd.y)
elif isinstance(cmd, Say) and cmd.text:
    speak(cmd.text)

# Do. Test and bind at once; the empty case is a pattern, not a guard.
match cmd:
    case Move(x=x, y=y):
        go(x, y)
    case Say(text=""):
        pass
    case Say(text=text):
        speak(text)
    case _:
        assert_never(cmd)
```

Class patterns match attributes, mapping patterns pull keys (`case {"op": "set", "key": k}`), or-patterns collapse variants (`case 401 | 403`). Two caveats: a bare name in a `case` binds, it does not compare (match against `Color.RED`, not a local `RED`); and a guard (`case Say(text=t) if t:`) doesn't narrow the negative branch, so it breaks `assert_never` exhaustiveness. Prefer patterns when you want the checker's proof.

## Comprehension restraint

A comprehension is for one transform and at most one filter. Denser than that, a loop reads better and takes a debugger.

```python
# Don't
result = [t.strip() for line in text.splitlines() if line for t in line.split(",") if t.strip() and not t.strip().startswith("#")]

# Do
result: list[str] = []
for line in text.splitlines():
    for token in line.split(","):
        token = token.strip()
        if token and not token.startswith("#"):
            result.append(token)
```

Side effects never go in a comprehension; a list built only to be discarded is a loop written dishonestly.

## Protocols

The consumer owns the interface: define the `Protocol` next to the code that uses it, containing only the methods it calls. Providers conform structurally and import nothing, which decouples the consumer from the provider's package and breaks import cycles.

```python
# Don't. Function couples to a concrete client it uses one method of.
from slack_client import SlackClient

def notify(client: SlackClient, text: str) -> None:
    client.post_message(text)

# Do. Consumer declares what it needs; the slack module is no longer imported.
from typing import Protocol

class MessageSink(Protocol):
    def post_message(self, text: str) -> None: ...

def notify(sink: MessageSink, text: str) -> None:
    sink.post_message(text)
```

No ABC registration, no inheritance, no adapter classes. With one concrete provider and no import cycle or package boundary in play, take the concrete type; the Protocol earns its keep when the second provider or the cycle is real. Add `@runtime_checkable` only if something genuinely needs `isinstance` against it; the type checker doesn't.

## No mutable defaults

Default values are evaluated once at definition time. A mutable default is shared across every call.

```python
# Don't. One list, shared forever.
def add_tag(tag: str, tags: list[str] = []) -> list[str]:
    tags.append(tag)
    return tags

# Do
def add_tag(tag: str, tags: list[str] | None = None) -> list[str]:
    tags = [] if tags is None else tags
    tags.append(tag)
    return tags
```

In dataclasses the factory says it directly:

```python
@dataclass
class Registry:
    entries: dict[str, Entry] = field(default_factory=dict)
```

## No util dumps

`utils.py` is where cohesion goes to die: unrelated functions accumulate, everything imports it, and nothing can be moved without touching the world. Name the module after the concept it owns.

```text
# Don't
app/
  utils.py        # format_price, retry, slugify, parse_ts, chunked

# Do
app/
  pricing.py      # format_price
  retry.py        # retry
  text.py         # slugify
```

A helper used by one module lives in that module. Split a module when it serves two distinct concerns, not when it hits a line count.

## Logging with context

`print` has no level, no timestamp, no destination, and no way off. Log through a module logger with the ids needed to debug from a single line.

```python
# Don't
print(f"payment failed for {user_id}")

# Do
import logging

logger = logging.getLogger(__name__)  # module level

logger.info("payment settled", extra={"payment_id": payment.id, "amount_cents": payment.amount_cents})

try:
    settle(payment)
except SettlementError:
    logger.exception("settlement failed", extra={"payment_id": payment.id})
    raise
```

Pass lazy args, not f-strings: `logger.debug("retrying %s", url)` skips formatting when the level is off. `logger.exception` inside a handler captures the traceback. Two `extra` caveats: the stdlib default formatter never renders `extra` keys, so the payoff needs a structured formatter (`python-json-logger`, or structlog's stdlib integration, where you bind context with `log.bind(payment_id=...)` instead); and a key that collides with a reserved `LogRecord` attribute (`message`, `asctime`, `module`, ...) raises `KeyError` at the call site.
