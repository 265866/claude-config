# Rust project setup

Read this when creating a Rust project, or when adding a workspace, toolchain pin, CI, commit check, release automation, or build profiles to one. A repository's established setup wins; adapt these to it rather than replacing it.

Replace `<owner>`, `<repo>`, `<lib>`, and each `<sha>` before committing.

## Virtual workspace

The root `Cargo.toml` holds only the workspace. A virtual workspace has no `package.edition` to infer the resolver from, so `resolver = "3"` (Rust 1.84+) must be explicit; without it Cargo falls back to resolver 1.

```toml
[workspace]
resolver = "3"
members = ["crates/*"]

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "MIT"
repository = "https://github.com/<owner>/<repo>"

[workspace.dependencies]
<lib> = { path = "crates/<lib>", version = "0.1.0", default-features = false }
serde = { version = "1", default-features = false }
```

Each member opts in to every field and dependency it inherits. A member may add `features`, `optional`, or `default-features` to an inherited dependency; features add to the workspace entry's.

```toml
[package]
name = "<lib>"
version.workspace = true
edition.workspace = true
license.workspace = true
repository.workspace = true

[dependencies]
serde = { workspace = true, features = ["std", "derive"] }
```

Set `default-features = false` in the `[workspace.dependencies]` entry and add features back per member. A member's own `default-features = false` switches off defaults the workspace entry enables only on Cargo 1.99+ with edition 2024; edition 2021 ignores it with a warning, and older Cargo rejects it on edition 2024.

## Toolchain pin

`rust-toolchain.toml` at the root makes local builds and CI use the same channel and components:

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
profile = "minimal"
```

rustup installs the named toolchain and any missing components on first use. CI runs `rustup toolchain install` with no arguments, which reads this file, so no toolchain-setup action is needed. GitHub-hosted Linux, macOS, and Windows runners ship rustup. `stable` moves every six weeks, so a new clippy lint can fail CI without a code change. Fix the new lint rather than loosening `-D warnings`.

## CI

Put this in `.github/workflows/ci.yml`. Pin every action to a full commit SHA with its exact release tag as a trailing comment; a tag can be moved to different code, a SHA cannot. The tags shown were current in October 2026; resolve the latest release, then its SHA with `gh api repos/<action-owner>/<action-repo>/commits/<tag> --jq .sha`, which follows annotated tags to the commit, or run `pinact run` over the workflow files.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

env:
  CARGO_TERM_COLOR: always

jobs:
  fmt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          persist-credentials: false
      - run: rustup toolchain install
      - run: cargo fmt --all -- --check

  check:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          persist-credentials: false
      - run: rustup toolchain install
      - uses: Swatinem/rust-cache@<sha> # v2.9.2
      # Per OS, so cfg(windows) and cfg(target_os = "macos") code is linted too.
      - run: cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
      - run: cargo test --locked --workspace --all-targets --all-features
      # --all-targets skips doctests.
      - run: cargo test --locked --workspace --doc --all-features
      # One cargo invocation per example, because features unify across every package an invocation selects.
      - name: Check each feature combination
        shell: bash
        run: |
          shopt -s nullglob
          for manifest in examples/*/Cargo.toml; do
            cargo check --locked --manifest-path "$manifest"
          done

  commits:
    # release-plz's default PR titles, such as `chore: release v1.2.3`, often have no scope.
    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'release-plz-')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      # HEAD is GitHub's merge commit, so HEAD^1..HEAD is exactly the PR's commits.
      - name: Check conventional commit subjects
        run: |
          pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\([a-z0-9][a-z0-9_/-]*\)!?: [^ ]'
          subjects=$(git log --no-merges --format=%s HEAD^1..HEAD)
          bad=$(printf '%s\n' "$subjects" | grep -Ev "$pattern" || true)
          if [ -n "$bad" ]; then
            printf 'Commit subjects must be type(scope): subject\n%s\n' "$bad"
            exit 1
          fi
```

`--locked` fails when `Cargo.lock` is stale instead of silently rewriting it, so commit `Cargo.lock`. Drop the doctest step when no member has a library target; Cargo errors only when none of the selected packages has one.

## Conventional commits

Every subject is `type(scope): subject`, with `!` before the colon for a breaking change. The scope is the crate or area the commit changes, such as `feat(parser): accept chunked bodies` or `fix(cli)!: exit non-zero on bind failure`. The `commits` job above enforces the shape on pull requests. It assumes merge or rebase merging; with squash merging, main receives the PR title instead, so check `github.event.pull_request.title` with the same pattern and add `types: [opened, edited, synchronize, reopened]` so a title edit reruns it. Git's default `Revert "..."` subject fails the pattern; reword it as `revert(scope): ...`. release-plz reads these subjects to choose the version bump and group the changelog, and treats a non-conforming commit as a patch.

## Releases for published libraries

Skip this section for binaries and unpublished crates. Writing the workflow files is local work. These are ask-first actions: a manual `cargo publish`, landing the release workflow on main once credentials exist, merging a release PR, crates.io trusted-publisher setup, and repository secrets or settings.

[release-plz](https://release-plz.dev) opens a release PR that bumps versions and updates `CHANGELOG.md` in Keep a Changelog format from conventional commits. The `release` job runs on every push to main and publishes, tags, and creates a GitHub release for any member version not yet on crates.io. It skips members with `publish = false`, so mark example crates that way.

`.github/workflows/release-plz.yml`:

```yaml
name: Release-plz

on:
  push:
    branches: [main]

jobs:
  release:
    if: github.repository_owner == '<owner>'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: read
      id-token: write
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - run: rustup toolchain install
      - uses: release-plz/action@<sha> # v0.5.142
        with:
          command: release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  release-pr:
    if: github.repository_owner == '<owner>'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    concurrency:
      group: release-plz-${{ github.ref }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - run: rustup toolchain install
      - uses: release-plz/action@<sha> # v0.5.142
        with:
          command: release-pr
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`id-token: write` uses crates.io trusted publishing, configured per crate on crates.io. Trusted publishing works only for a crate that already exists, so the first manual `cargo publish` must happen before `release-plz.yml` lands; otherwise the `release` job fails on its first push. Without trusted publishing, drop `id-token: write` and pass `CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}` to the `release` step, using a token scoped to `publish-new` and `publish-update`. The repository setting "Allow GitHub Actions to create and approve pull requests" must be on for `release-pr`. A PR opened with `GITHUB_TOKEN` does not trigger CI, so when branch protection requires checks, pass a GitHub App token or fine-grained PAT as `GITHUB_TOKEN` to the `release-pr` step. Both jobs work without a `release-plz.toml`.

## One example crate per feature combination

For a library with Cargo features, add one workspace member under `examples/` for each supported combination, including no features, and add `"examples/*"` to `members` with the first one. Each depends on the library with defaults off and exactly its features, and uses the API that combination exposes:

```toml
# examples/json/Cargo.toml
[package]
name = "example-json"
version = "0.0.0"
edition.workspace = true
publish = false

[dependencies]
<lib> = { workspace = true, features = ["json"] }
```

The example doubles as usage documentation for that combination. The CI loop checks each one in its own invocation; a single `cargo check --workspace` unifies every example's features and hides a combination that fails alone.

## Release and profiling profiles

These go in the root `Cargo.toml`, because Cargo ignores `[profile.*]` in member manifests.

```toml
[profile.release]
lto = true
codegen-units = 1

[profile.profiling]
inherits = "release"
debug = true
```

`lto = true` is fat LTO; `lto = false` still runs thin-local LTO, and `"off"` disables it. Build with `cargo build --profile profiling`, which writes to `target/profiling`. Release builds strip debuginfo by default when debug is off; `profiling` keeps the symbols a profiler needs.
