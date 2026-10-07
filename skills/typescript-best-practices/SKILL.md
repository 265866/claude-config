---
name: typescript-best-practices
description: TypeScript best practices. Use when reading or editing any .ts, .tsx, .mts, or .cts file.
paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
---

# TypeScript best practices

Apply the **principle-type-system-discipline** principle skill first.

Check the project's TypeScript version before applying version-gated syntax: `satisfies` needs TypeScript 4.9. On an older version, annotate the value with the target type instead; where annotation would widen the inferred type, as in the schema shape checks, use a generic identity check such as `const conforms = <T,>() => <U extends T>(u: U) => u;` (the trailing comma keeps it valid in `.tsx`). Unlike `satisfies`, it accepts extra keys, so check those separately when they matter. `in` narrowing of a property the type does not declare (`"id" in data`, then `data.id`) also needs 4.9; on an older version, narrow with a guard such as `const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;` and read through it.

| Rule | Summary |
|------|---------|
| Discriminated unions | Model variants with one literal discriminant (`kind`, `type`, or `tag`, matching the codebase) so impossible states can't be represented. No optional-field bags. |
| Branded types | Brand primitives with `& { readonly __brand: "X" }` so they can't be mixed up. Validate once at the boundary. |
| Constructive modeling | Build the shape so the illegal value can't be constructed. `[T, ...T[]]` for non-empty, `[T, T][]` for even length, `start` plus `duration` for a range. Not a runtime guard, not a wish for refinement types. |
| Simplest total type | Keep `T[]` while every operation on it stays total. Strengthen to `NonEmpty<T>` only where the loose type forces `!`, a cast, or a "should never happen" throw. |
| `unknown` over `any` | External data is `unknown`. |
| Schemas before guards | Before hand-writing a property-by-property type guard, use the repository's runtime schema library and infer the type from the schema, such as `z.infer`. When another source owns the type, derive the schema from that source if the repository already generates schemas from it. Otherwise, check a hand-written schema and its shape's keys against the type with `satisfies`, as the patterns reference shows. |
| No `as` casts | Every `as` is a runtime crash waiting. Cast only after validation. |
| Narrowing hierarchy | Discriminant switch > `in` operator > `typeof`/`instanceof` > user-defined type guard > `as`. |
| Type guards | Must verify the claim. A lying guard is worse than `as` because the bug hides behind a name that says it's safe. Name them `isX` or `hasX`. |
| Exhaustiveness | In default arms, bind `const _exhaustive: never = x;`, then `return _exhaustive;` in a value-returning switch or `void _exhaustive;` in a statement switch, so the compiler errors when a new variant is added. |
| `satisfies` over `as` | Checks the value against the type while keeping the expression's own inferred type, so literals stay literal wherever the target type allows them. `as` replaces the inferred type with the target type. |
| Boundary validation | Parse where data crosses in, into a named domain type. `Record<string, unknown>` (however spelled) stops at that parse. Trust types inside. See the **principle-boundary-discipline** principle skill. |
| Schema-derived types | Reach for `Pick`/`Omit`/`Parameters`/`ReturnType`/`Awaited`/`typeof` before declaring a new interface. |
| Object args | Pass objects, not positional, so argument order is self-documenting. Skip on hot paths (per-frame render, tokenizers, parsers). |
| Real tests | Don't mock what you can run. Prefer the framework's real test primitives with leak/disposable checks, and verify UI in a running build. Add a substitute only when the real dependency cannot run in the test, and report that reason. |
| Structured telemetry | Prefer structured logger diagnostics with enough context to debug from an id. No `console.log` in shipped code. |

Examples: [references/patterns.md](${CLAUDE_SKILL_DIR}/references/patterns.md).
