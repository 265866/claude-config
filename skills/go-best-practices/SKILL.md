---
name: go-best-practices
description: Go best practices. Use when reading or editing any .go file.
paths: ["**/*.go"]
---

# Go best practices

Apply the **principle-type-system-discipline** principle skill first.

| Rule | Summary |
|------|---------|
| Illegal states unrepresentable | Unexported fields plus a validating constructor when invariants exist; small defined types over raw strings and ints. Validate once at creation. |
| Enums | Defined type + `iota` constants, zero value reserved for invalid unless zero is a real default. `switch` isn't exhaustive; make default arms fail loudly. |
| Consumer-side interfaces | Accept interfaces, return concrete types. Define the interface in the package that uses it, sized to what that consumer calls. No producer-side interfaces "for mocking". |
| Error wrapping | `%w` keeps the chain for `errors.Is`/`As`; `%v` severs it at trust boundaries. Terse lowercase context, no "failed to" cascades. Sentinel `ErrX` for identity, typed `XError` for data. Never return a typed nil as `error`. |
| Useful zero values | Make the zero value ready to use: `var mu sync.Mutex`, `var buf bytes.Buffer`, lazy map init inside methods. Never copy a struct holding a mutex. No constructor ceremony when the zero value works. |
| Goroutine lifetimes | Every goroutine has a known exit and someone who waits. `errgroup.WithContext` + `SetLimit` for fan-out; no fire-and-forget. In modules declaring go 1.22+, loop vars are per-iteration: no `x := x` copies. |
| Channel ownership | The writing goroutine creates and closes the channel; receivers `range` and cancel or drain if they stop early. Return `<-chan T` to encode ownership. Unbuffered or size 1 unless measured otherwise. |
| Context discipline | `ctx context.Context` is the first parameter, never a struct field. `defer cancel()` on every derived context. Values carry request-scoped cross-cutting data (trace id, principal), never ordinary parameters. |
| Generics restraint | Type parameters only when identical bodies differ only by type. If the body just calls methods, use an interface. Check `slices`, `maps`, `cmp` before writing your own. |
| Aliasing | Slices are headers over shared memory; maps are pointers to it. Clone at ownership boundaries; `append` on a subslice can overwrite the parent. |
| Options ladder | Plain args, then a config struct, then functional options. Escalate only when most callers want defaults and the option list is long or growing. |
| defer cleanup | `defer` the release immediately after a successful acquire. Writers capture the `Close` error (writeback failures surface there); read-only closes discard it explicitly. |
| slog | Structured key-value logging via `slog`; `*Context` variants so handlers see trace ids; `slog.With` for repeated attrs; `LogAttrs` on hot paths. |
| Package layout | Packages named by what they provide, read at the call site. No `util`/`common`/`helpers`. `internal/` for non-public code. No stutter (`store.Client`, not `store.StoreClient`). |
| Table-driven tests | Slice of named cases + `t.Run` subtests. `t.Helper()` in assertion helpers, `t.Cleanup` (not `defer`) in setup helpers. |
| Narrow suppressions | Never add `_ = err` or `//nolint` to silence a real problem. For a genuine false positive, use `//nolint:<linter>` with a one-line justification. |

Examples: [references/patterns.md](${CLAUDE_SKILL_DIR}/references/patterns.md).
