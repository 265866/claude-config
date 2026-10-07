# Rust patterns

Code examples for the rules in `SKILL.md` that benefit from one. The underlying principles are language-agnostic. See the **principle-type-system-discipline** and **principle-boundary-discipline** principle skills.

## Newtypes for domain values

Wrap the primitive, keep the field private, validate in one fallible constructor. Everything downstream takes the newtype and skips re-checking.

```rust
// Don't. Any string passes; every function re-validates or trusts blindly.
fn send_invoice(customer_email: &str) { /* ... */ }

// Do. Parse once; the type carries the proof.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(String);

impl Email {
    pub fn parse(s: String) -> Result<Self, EmailError> {
        if !s.contains('@') {
            return Err(EmailError::Invalid(s));
        }
        Ok(Email(s))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

fn send_invoice(customer: &Email) { /* input is trusted */ }
```

Same move for units: `struct Millis(u64)` and `struct Bytes(u64)` can't be swapped. Derive only what the semantics support; a type with a constructor invariant must not derive `Default` or expose `pub` on the inner field, or the invariant leaks.

## Illegal states unrepresentable

If a bug forces the question "can this combination actually happen?", the type is too loose. One enum variant per real state, data attached to the variant that has it.

```rust
// Don't. Connected-with-error and token-while-disconnected are constructible.
struct Connection {
    connected: bool,
    session_token: Option<SessionToken>,
    last_error: Option<io::Error>,
}

// Do. Only valid states exist; match forces handling each.
enum Connection {
    // last_error None: never connected yet; Some: the failure that put us here.
    Disconnected { last_error: Option<io::Error> },
    Connecting,
    Connected { session_token: SessionToken },
}
```

The surviving `Option` encodes two real states, not a maybe-set field; that is the test for keeping one.

Closed sets of strings are enums, not `&str`:

```rust
// Don't. "debug"? "Debug"? "verbose"? Typos compile.
fn set_level(level: &str) { /* ... */ }

// Do. Text becomes a Level once, at the boundary, via FromStr.
enum Level { Debug, Info, Warn, Error }

fn set_level(level: Level) { /* ... */ }

fn configure(arg: &str) -> anyhow::Result<()> {
    let level: Level = arg.parse()?; // impl FromStr for Level at the boundary
    set_level(level);
    Ok(())
}
```

## Exhaustive match

A `_` arm on an enum you own silently absorbs the next variant someone adds. List every variant; the compiler then flags every match that needs a decision.

```rust
// Don't. Event::Resized lands in `_` unnoticed.
match event {
    Event::Opened => open(),
    Event::Closed => close(),
    _ => {}
}

// Do. Adding a variant breaks the build at every match that must decide.
match event {
    Event::Opened => open(),
    Event::Closed => close(),
    Event::Resized { .. } => {}
}
```

When several variants share behavior, group them explicitly (`Event::Resized { .. } | Event::Moved { .. } => {}`) instead of `_`. Upstream enums marked `#[non_exhaustive]` force a `_` arm; keep it narrow and keep the named arms complete for the variants that exist today.

## thiserror for libraries, anyhow for applications

Decision rule: will any caller match on the error? Yes: a `thiserror` enum with variants worth matching. No, it's only logged or shown: `anyhow::Result` and move on.

```rust
// Library. Callers can match NotFound vs Io; #[from] powers `?`.
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("key not found: {0}")]
    NotFound(String),
    #[error("store io")]
    Io(#[from] std::io::Error),
}
```

Variant messages don't repeat their source (`Io` prints "store io", not the io message); whatever reports the error must render the chain; anyhow's `{:#}` alternate format does.

```rust
// Application. One error type end to end, context stacked as it bubbles.
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config().context("loading config")?;
    run(config)
}
```

```rust
// Don't. Unmatchable, uncomposable, loses the source chain.
fn load() -> Result<Config, String> { /* ... */ }
```

`Box<dyn Error>` in a public API is the same mistake with extra steps. `thiserror` never appears in your public API, so adopting or dropping it is not a breaking change.

## Context at boundaries

A raw `io::Error` says "No such file or directory" and nothing else. Attach what was being done and to which input at the point where the error crosses a layer, not deep inside helpers.

```rust
use anyhow::Context;

// Don't. The caller learns something failed, not what or where.
let bytes = fs::read(&path)?;

// Do. Names the operation and the input.
let bytes = fs::read(&path)
    .with_context(|| format!("reading config {}", path.display()))?;
```

`with_context` takes a closure so the format allocation only happens on failure; use plain `.context("...")` for static strings. For typed errors the same rule means data-carrying variants: `NotFound(String)` with the key, not `NotFound`.

## `?`, let-else, combinators

`?` for propagation. Never match a `Result` just to rethrow.

```rust
// Don't
let file = match File::open(path) {
    Ok(f) => f,
    Err(e) => return Err(e.into()),
};

// Do
let file = File::open(path)?;
```

`let-else` for guard clauses; the happy path stays flat and unindented.

```rust
// Don't. Arrow code.
if let Some(user) = lookup(id) {
    if let Some(email) = user.email {
        send(email);
    }
}

// Do
let Some(user) = lookup(id) else { return Ok(()) };
let Some(email) = user.email else { return Ok(()) };
send(email);
```

Combinators (`map`, `and_then`, `ok_or_else`, `unwrap_or_default`) for one-step transforms. Once both arms carry logic, or a chain needs three combinators where a `match` needs two arms, write the `match`.

## unwrap and expect discipline

Most unwraps mark a place where the proof and the use drifted apart. Restructure so the `Option` is consumed where it's decided and the unwrap never appears.

```rust
// Don't. The check and the unwrap drift apart under edit.
if map.contains_key(&id) {
    let user = map.get(&id).unwrap();
    notify(user);
}

// Do. One lookup, nothing to justify.
if let Some(user) = map.get(&id) {
    notify(user);
}
```

Where an `expect` survives, the invariant must be proven nearby, and the message states the invariant, not the failure. It documents why this can't happen and reads correctly in panic output ("should" style, per the std docs).

```rust
// Don't. Restates the failure; the panic message adds nothing.
let re = Regex::new(PATTERN).expect("regex failed to compile");

// Do. States the invariant.
let re = Regex::new(PATTERN).expect("hardcoded PATTERN should be a valid regex");
```

## Deliberate ownership in signatures

Pick the parameter type from what the function does with the value, not from what's convenient at the first call site.

- Read only: `&str`, `&[T]`, `&T`. Never `&String` or `&Vec<T>`; deref coercion makes the borrowed slice strictly more general.
- Store it: take `String`/`T` by value. The caller decides whether to move or clone.
- Mutate in place: `&mut T`.

```rust
// Don't. Borrows, then clones anyway; the allocation hides from the caller.
fn new(name: &str) -> Self {
    Self { name: name.to_string() }
}

// Do. Honest signature; the caller chooses move or clone.
fn new(name: String) -> Self {
    Self { name }
}
```

`impl Into<String>` makes both `&str` and `String` callers ergonomic at the cost of monomorphized copies and a hidden allocation; reserve it for constructors on ergonomics-critical public APIs. `Cow` when the function usually returns the input unchanged:

```rust
use std::borrow::Cow;

// Allocates only when a change is actually needed.
fn normalize(path: &str) -> Cow<'_, str> {
    if path.contains('\\') {
        Cow::Owned(path.replace('\\', "/"))
    } else {
        Cow::Borrowed(path)
    }
}
```

## Iterator chains, one allocation

Iterator adapters are lazy; a fused chain does one pass and allocates once at the final `collect`. Intermediate `collect`s throw that away.

```rust
// Don't. Two Vecs, two passes, clones that get filtered out.
let names: Vec<String> = users.iter().map(|u| u.name.clone()).collect();
let active: Vec<String> = names.into_iter().filter(|n| !n.is_empty()).collect();

// Do. One pass, one allocation; filter first so discarded items are never cloned.
let active: Vec<String> = users
    .iter()
    .filter(|u| !u.name.is_empty())
    .map(|u| u.name.clone())
    .collect();

// Further, when the caller only reads: borrow and the clones disappear too.
let active: Vec<&str> = users
    .iter()
    .map(|u| u.name.as_str())
    .filter(|n| !n.is_empty())
    .collect();
```

Don't collect to inspect: `iter.count()`, `iter.next()`, `iter.any(..)` answer without building a `Vec`.

## Default before builder

For config-like structs where the default per field is meaningful, `Default` plus struct update syntax is the whole pattern.

```rust
// Don't. A hand-rolled builder for three optional knobs.
let cfg = ConfigBuilder::new().verbose(true).build()?;

// Do
#[derive(Default)]
pub struct Config {
    pub verbose: bool,          // false
    pub follow_symlinks: bool,  // false
    pub threads: Option<usize>, // None = auto
}

let cfg = Config { verbose: true, ..Default::default() };
```

A builder earns its keep when construction validates cross-field invariants, or the struct is public API whose fields must stay private to evolve (struct update syntax needs every field public). Then `build()` returns `Result` and does the validation once.

## Concrete before trait

An abstraction with one implementor is indirection, not abstraction. Write the concrete type; extract the trait when the second implementor is real.

```rust
// Don't. One implementor hiding behind a trait "for testability, later".
trait Storage {
    fn get(&self, key: &str) -> Option<Vec<u8>>;
}
struct DiskStorage;

// Do. The concrete type, directly.
struct DiskStorage;
impl DiskStorage {
    fn get(&self, key: &str) -> Option<Vec<u8>> { /* ... */ }
}
```

In a published crate, seal a public trait downstream crates must not implement, via a private supertrait; you can then add methods without a semver break. Internal code has no downstream: edit the trait and its impls together, no ceremony.

```rust
pub struct Local;

mod private {
    pub trait Sealed {}
    impl Sealed for super::Local {}
}

pub trait Backend: private::Sealed {
    fn run(&self);
}

impl Backend for Local {
    fn run(&self) { /* ... */ }
}
```

Prefer generic `impl Trait` parameters over `Box<dyn Trait>`; box only for heterogeneous collections or trait objects stored in structs.

## Simplest smart pointer

Escalate one step at a time and stop as soon as it compiles: plain ownership, then `&`/`&mut`, then `Box` (recursive types, trait objects), then `Rc` (shared, single-threaded), then `Arc` (shared across threads). Add `RefCell`/`Mutex` only when the data is both shared and mutated. Every step costs: refcount traffic, lock contention, runtime borrow panics.

```rust
// Don't. Arc<Mutex<..>> as a reflex for "shared".
struct App {
    config: Arc<Mutex<Config>>, // never mutated after startup
}

// Do. Shared and immutable needs no lock.
struct App {
    config: Arc<Config>,
}
```

`RefCell` trades a compile error for a runtime panic; before reaching for it, restructure so the borrow checker can see the truth: pass `&mut` down, return the new value up, or split the struct so disjoint fields borrow independently.

## Privacy enforces invariants

`pub` fields let any code anywhere break the invariant. Private fields make the module boundary the proof boundary: only code in this module can touch the raw data, so only this module must be audited.

```rust
// Don't. Anyone can set count > max.
pub struct Counter {
    pub count: u32,
    pub max: u32,
}

// Do. The invariant lives in one small module.
pub struct Counter {
    count: u32,
    max: u32,
}

impl Counter {
    pub fn new(max: u32) -> Self {
        Self { count: 0, max }
    }

    pub fn increment(&mut self) -> Result<u32, LimitReached> {
        if self.count == self.max {
            return Err(LimitReached);
        }
        self.count += 1;
        Ok(self.count)
    }
}
```

Keep the module holding the raw fields small; its size is the size of the audit surface.

## `unsafe`

Don't. What looks like a job for `unsafe` is usually a missing std method or an existing crate that already wraps it soundly. When it's genuinely unavoidable, keep the block as small as possible, put it behind a safe API whose module upholds the invariant (same privacy rule as above), and write a `// SAFETY:` comment naming the invariant, not the operation.

```rust
// Don't. Unsafe at the call site, invariant unstated, every caller must re-reason.
let s = unsafe { std::str::from_utf8_unchecked(&bytes) };

// Do. Smallest block, safe wrapper, SAFETY names the upheld invariant.
pub fn as_str(&self) -> &str {
    // SAFETY: `bytes` was validated as UTF-8 in `Self::parse`.
    unsafe { std::str::from_utf8_unchecked(&self.bytes) }
}
```

## From/TryFrom conversions

Standard conversion traits are discoverable and compose with `?`, `#[from]`, and generic bounds. Ad-hoc methods do none of that.

```rust
// Don't. Undiscoverable, and panics on bad input.
impl Config {
    fn make_from_raw(raw: RawConfig) -> Config { /* panics on invalid */ }
}

// Do. Fallible conversion is TryFrom; the error is part of the signature.
impl TryFrom<RawConfig> for Config {
    type Error = ConfigError;

    fn try_from(raw: RawConfig) -> Result<Self, Self::Error> { /* ... */ }
}
```

Infallible conversions implement `From`; `Into` comes free via the blanket impl, so never implement `Into` directly. Text parsing is `FromStr`, giving callers `s.parse::<Level>()?`.

## Structured concurrency and cancellation

Detached `tokio::spawn` tasks outlive their caller, swallow panics, and keep running after the request that spawned them died. Scope related tasks to a `JoinSet`: results come back through `join_next`, panics surface as `JoinError`, and dropping the set aborts everything still running.

```rust
// Don't. Fire-and-forget fan-out; errors and lifetimes vanish.
for url in urls {
    tokio::spawn(fetch(url));
}

// Do. Tasks can't outlive the set; every outcome is observed.
let mut set = tokio::task::JoinSet::new();
for url in urls {
    set.spawn(fetch(url));
}
while let Some(res) = set.join_next().await {
    let page = res??; // JoinError (panic/abort), then fetch's own error
    process(page);
}
```

`join_next` returns `Option<Result<T, JoinError>>` and is cancel-safe in `select!`. A lone background task that genuinely should outlive the caller keeps its `JoinHandle` somewhere that awaits or aborts it; a dropped handle detaches the task.

Cancellation is the other half. `select!` polls its branches in random order and, when one wins, drops the losing futures. A dropped future loses its in-flight state, so a method that buffers partial progress corrupts the stream when another branch wins. Each async method's docs state whether it is cancellation safe; check before putting it in a select loop.

```rust
// Don't. read_line is not cancel-safe: a shutdown poll that wins mid-read
// discards partially read bytes.
loop {
    tokio::select! {
        n = reader.read_line(&mut buf) => handle(&buf, n?),
        _ = shutdown.cancelled() => break,
    }
}

// Do. Lines::next_line is cancel-safe; no bytes are lost across iterations.
let mut lines = reader.lines();
loop {
    tokio::select! {
        line = lines.next_line() => match line? {
            Some(line) => handle(line),
            None => break,
        },
        _ = shutdown.cancelled() => break,
    }
}
```

When the future you need isn't cancel-safe, create it once outside the loop and poll the same instance (`tokio::pin!` plus `&mut fut` in the branch) instead of recreating it per iteration. `mpsc::Receiver::recv` and `CancellationToken::cancelled` are cancel-safe workhorses for this shape.

## Don't block the runtime

An async worker thread that doesn't reach an `.await` stalls every task scheduled on it. Sync I/O and sustained CPU work both count; keep the stretches between `.await`s in the tens-of-microseconds range.

```rust
// Don't. ~100ms of CPU on the async worker; neighbors starve.
async fn hash_password(pw: String) -> PasswordHash {
    argon2_hash(&pw)
}

// Do. Blocking pool does the work; the async task just awaits.
async fn hash_password(pw: String) -> anyhow::Result<PasswordHash> {
    let hash = tokio::task::spawn_blocking(move || argon2_hash(&pw)).await?;
    Ok(hash)
}
```

The swap isn't free at the signature: `spawn_blocking` returns a `JoinHandle`, so a `JoinError` (the closure panicked or was aborted) now sits in front of the function's own errors for every caller. Same treatment for sync file/DB clients: `spawn_blocking`, or the async equivalent (`tokio::fs`, `tokio::time::sleep`) where one exists. `std::sync::Mutex` is correct in async code for short critical sections; switch to `tokio::sync::Mutex` only when the guard must be held across an `.await`, and treat that as a design smell first.

## Test placement

Unit tests live in a `#[cfg(test)] mod tests` at the bottom of the file they test, where they can reach private items. Integration tests live in `tests/`; each file is its own crate compiled against the public API only, so they prove what a downstream user can actually do.

```rust
fn parse_digits(s: &str) -> Option<u32> { /* private */ }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty() {
        assert_eq!(parse_digits(""), None);
    }
}
```

Doctests are compiled examples: code blocks in doc comments build and run under `cargo test` (library targets; `no_run`/`ignore` opt out), so put one on each entry-point API and it can't drift from the code.

```rust
/// A log level, parsed from its lowercase name.
///
/// ```
/// use mylib::Level;
/// assert_eq!("warn".parse::<Level>().unwrap(), Level::Warn);
/// ```
#[derive(Debug, PartialEq, Eq)]
pub enum Level { Debug, Info, Warn, Error }

#[derive(Debug)]
pub struct ParseLevelError(String);

impl std::fmt::Display for ParseLevelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "unknown log level: {}", self.0)
    }
}

impl std::error::Error for ParseLevelError {}

impl std::str::FromStr for Level {
    type Err = ParseLevelError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "debug" => Ok(Self::Debug),
            "info" => Ok(Self::Info),
            "warn" => Ok(Self::Warn),
            "error" => Ok(Self::Error),
            _ => Err(ParseLevelError(s.to_owned())),
        }
    }
}
```
