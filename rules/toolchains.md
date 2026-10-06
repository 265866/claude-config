# Toolchains and verification

Use the project's configured commands and established stack first. Add a dependency or tool to a project, its manifests, or its lockfile when the task needs it, and report it. Install throwaway tooling used only to build, test, or inspect the work (for example a portable toolchain, a browser driver, or a harness library) into a fresh temporary directory outside the project and remove it when the task no longer needs it; on a remote machine, use that machine's temporary directory. A package manager's normal download cache, and ephemeral runners such as `uvx` or `bunx`, count as throwaway. Report what you installed and removed. System-wide or user-profile installs, such as OS package-manager installs, global package or tool installs, global binaries, or shell profile changes, are allowed when the task needs them; report each one by name with what it changed. Do not change versions or lockfiles unless dependencies, package metadata, toolchain requirements, or the requested release require it.

## JavaScript and TypeScript

Never use npm or yarn. Use pnpm when the project has pnpm-lock.yaml, pnpm-workspace.yaml or a pnpm packageManager entry; otherwise use Bun. Prefer precise types, generics, or unknown with narrowing to any. Keep an unavoidable any narrow with a one-line reason.

When dependency inputs changed, update the lockfile with the package manager selected above and verify a frozen install. If the project's existing lockfile belongs to npm or yarn, stop and ask before changing dependencies rather than switching managers or leaving the lockfile stale. Run both typecheck and build when configured, the formatter check, every configured lint/static-analysis script, and relevant tests including integration/end-to-end checks when the boundary warrants them. Recheck formatting after formatter writes. Do not leave unrelated lockfile churn.

## Python

uv is the Python executor. Use uv run, uvx, uv add/remove or uv pip as appropriate; do not invoke Python directly or create manual virtual environments. Run uv sync --locked or uv lock --check, the configured formatter check, lint, configured type checker and relevant pytest suite. Add an absent check tool like any other dependency when the task needs that check. Never invent a passing result.

## Go

Use explicit error returns, context propagation and structured resource lifetimes. Never discard a real error or silence it with a broad suppression. gofumpt, golangci-lint and govulncheck are pre-authorized to install via go install if missing: `go install mvdan.cc/gofumpt@latest`, `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`, `go install golang.org/x/vuln/cmd/govulncheck@latest`.

Before committing, run in order: `go build ./...`; `gofumpt -l -w .` followed by `gofumpt -l .` expecting no output; `go mod tidy` followed by `git diff --exit-code go.mod go.sum`; `go vet ./...`; `golangci-lint run`; `go test -race -cover ./...`; `govulncheck ./...`. Report each result and fix real failures without weakening checks.

## Rust

Encode invariants in types, borrow when ownership is unnecessary, avoid needless allocation/copying, and return contextual Result errors for recoverable failures. Do not panic on user-controlled input or I/O. Add rustfmt and clippy with rustup component add if missing.

Use the repository's feature matrix, otherwise --all-features. Run cargo fmt --all -- --check; cargo check --all-targets --all-features; cargo clippy --all-targets --all-features -- -D warnings; cargo test --all-targets --all-features; and, when the crate has a library target, cargo test --doc --all-features, because --all-targets does not run doctests. A heavy workspace may use a contained crate test when that scope is justified. Update Cargo.lock only for dependency or feature metadata changes.

## Behavior and review

Meaningful code changes need happy-path, edge and regression/boundary assertions. Prefer a failing regression test before a bug fix. Existing behavior tests can cover a purely mechanical change; state what ran. Test against the real dependency. Add a mock, fake, simulator, clock substitute or network stand-in only when the real one cannot run in the test, and report it with that reason. Integration-test a real dependency when it runs cheaply.

Run the narrow behavior check first, then configured build/lint/format gates, then fresh-context review. Review coverage-first, including uncertain and low-severity findings with confidence. Fix real findings and re-check the affected area. Read-only investigations do not authorize code edits. A one-line change, formatting correction or narrow rename can be verified directly without a separate review.

For UI changes, run the real surface when feasible and save screenshots when visual correctness matters. Type checks and unit tests do not establish visual correctness. Do not add a speculative performance benchmark; measure a concrete hot path, requirement or unresolved trade-off.

Keep artifacts and logs for meaningful evidence, not padding. Never claim a command passed without its output. A missing tool, integration, authorization or failed check is a stated constraint, not a reason to weaken the gate. Marking a failing check non-blocking or allowed to fail weakens it, even when the cause is upstream.
