# Design red flags

Screen every candidate before synthesis. A red flag is a reason to revise or reject the shape. A flag in existing code outside the task's scope is reported, not fixed. In a design the user chose, report the flag instead of overriding the design.

## Shallow module

A shallow module exposes a large interface while hiding little complexity. Judge depth by the capability and policy hidden behind the public surface relative to the size of that surface. Prefer a simple interface backed by substantial behavior.

Do not confuse a deep module with a deep call chain. A deep call chain scatters understanding across layers. A deep module concentrates capability behind one interface.

Look for these signs:

- Callers coordinate several methods to complete one operation.
- Public options expose internal stages or implementation choices.
- Learning the interface does not save the caller from learning the implementation.

## Information leakage

Information leakage makes multiple modules depend on the same internal decision. A representation, policy, or protocol detail appears in more than one place, so changing it requires coordinated edits.

Public re-exports of transport or wire types are leakage. Parse external data into domain types behind the interface. Keep storage schemas, framework objects, and protocol details private.

## Temporal decomposition

Temporal decomposition organizes modules by execution order instead of the knowledge they own. Separate load, validate, transform, and save stages often repeat one representation and its invariants across several boundaries.

Group code around domain knowledge and ownership. Methods that run at different times can still belong to one module when they protect the same decisions.

## Pass-through method

A pass-through method forwards the same arguments to another method with the same shape. It adds a layer without hiding complexity.

Remove it or move responsibility to the module that can complete the operation. Keep a forwarding boundary only when it adds policy, adaptation, or a distinct abstraction.

## Split ownership

More than one module writes the same state or keeps its own copy of it. An agent that edits one writer can't see the others, so their rules diverge.

Give each piece of state one owner. Other modules read it or ask the owner to change it.

## Two ways to do one task

The design supports more than one way to do the same task. An agent copies whichever way it finds first, so every way keeps gaining callers.

Keep one way. Migrate callers and delete the others in the same wave, per [principle-migrate-callers-then-delete-legacy-apis](../../principle-migrate-callers-then-delete-legacy-apis/SKILL.md), unless external users depend on them. Report existing duplicates outside the task's scope instead of fixing them.

## Importable internals

A caller can import a module's internals. An agent takes the shortest path that compiles, so it imports them directly and they become part of the interface.

This flag applies when a candidate creates a module boundary that other code will import. Make internals unreachable from outside the module, so an import from outside fails the build. Use the language's own boundary where it has one:

- Go: put internals under an `internal/` directory.
- Rust: keep them private to the module. Use `pub(crate)` only when the boundary is the whole crate.
- TypeScript: list the public entry points in the package's `exports` field. TypeScript enforces it only for imports by package name, with `moduleResolution` set to `node16`, `nodenext`, or `bundler`. Inside one package, add a lint rule such as `no-restricted-imports` that runs in CI. Adding `exports` to a published package that had none changes its public interface, so treat it as a breaking change.
- Python: the language cannot enforce this. Prefix internals with `_` and add an import-linter contract that runs in CI.

## Hand-synced list

Two or more places list the same items, and adding an item means editing every list. An agent that sees one list updates only that one.

Keep one list and derive the others from it. If a list can't be derived, make the build fail when the lists disagree.
