---
name: rust-best-practices
description: Rust best practices. Use when reading or editing any .rs file.
paths: ["**/*.rs"]
---

# Rust best practices

Apply the **principle-type-system-discipline** principle skill first.

Respect `rust-version` in Cargo.toml before applying version-gated syntax: let-else needs Rust 1.65. On an older floor, use `match` or `if let` with an early return.

| Rule | Summary |
|------|---------|
| Newtypes for domain values | Wrap primitives in a struct with a private field and a fallible constructor. Parse once at the boundary; downstream code trusts the type. |
| Illegal states unrepresentable | Model state machines as enums with per-variant data, not bool + `Option` bags. Closed string sets become enums, not `&str`. |
| Exhaustive match | No catch-all `_` arm on enums you own; adding a variant must break every match. `_` only for upstream `#[non_exhaustive]` enums. |
| thiserror for libraries, anyhow for applications | Library: `thiserror` enum callers can match on. Application: `anyhow::Result` everywhere errors are only reported. Never `String` or `Box<dyn Error>` in a public API. |
| Context at boundaries | Attach what-and-which context where an error crosses a layer: `.with_context(...)` for anyhow, data-carrying variants for typed errors. |
| `?`, let-else, combinators | `?` for propagation, `let-else` for guard clauses, combinators for one-step transforms, `match` when both arms carry logic. |
| unwrap and expect discipline | Restructure so the `Option` is consumed where it's decided; no check-then-unwrap. A surviving `expect` proves its invariant nearby and its message states the invariant, not the failure. |
| Panic policy | Recoverable failure returns `Result`; never panic on input, I/O, network, or configuration errors. Panics are for tests and impossible states that mean a programmer bug. |
| Allocation discipline | Treat allocation, copying, locking, and data layout as design choices. Avoid unneeded `clone`, `to_string`, `collect`, and boxing; prefer explicit loops over iterators when they avoid allocation or early-exit cleanly. Keep code simple until the hot path or data size makes the cost real; benchmark only when the trade-off isn't clear from the code. |
| Deliberate ownership in signatures | Read: `&str`/`&[T]`/`&T`. Store: take by value. Mutate: `&mut`. `impl Into<String>` only on ergonomics-critical constructors. `Cow` when writes are rare. |
| Iterator chains, one allocation | Fuse the pipeline; `collect()` once at the end. Filter before you clone. No intermediate `Vec`s, no collect-to-inspect. |
| Default before builder | `Default` + struct literal for config-like structs. A builder needs to earn it: cross-field validation, private fields in a public API. |
| Concrete before trait | No trait with one implementor; introduce it with the second. Seal published traits downstream crates must not implement. |
| Simplest smart pointer | Own > `&`/`&mut` > `Box` > `Rc` > `Arc`; add `RefCell`/`Mutex` only for shared **and** mutated. Restructure ownership before interior mutability. |
| Privacy enforces invariants | Private fields plus constructor make the invariant unbreakable outside the module. Keep that module small enough to audit. |
| `unsafe` | Don't. When unavoidable: smallest block, behind a safe API, `// SAFETY:` comment naming the invariant upheld. |
| From/TryFrom conversions | Infallible: `From` (never `Into` directly). Fallible: `TryFrom`. Standard traits compose with `?` and generic code; ad-hoc methods don't. |
| Structured concurrency and cancellation | Fan related tasks into a `JoinSet`: awaited, panics surfaced, aborted on drop. `select!` drops losing futures, so its loops must await only cancel-safe futures. |
| Don't block the runtime | No sync I/O or long CPU work between `.await`s. `spawn_blocking` for both; `std::sync::Mutex` unless the guard lives across an `.await`. |
| Test placement | Unit tests in `#[cfg(test)] mod tests` beside the code (sees private items); integration tests in `tests/` against the public API; doctests keep public examples compiling. |

Examples: [references/patterns.md](${CLAUDE_SKILL_DIR}/references/patterns.md).
