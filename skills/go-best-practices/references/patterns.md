# Go patterns

Code examples for the rules in `SKILL.md` that benefit from one. The underlying principles are language-agnostic. See the **principle-type-system-discipline** and **principle-boundary-discipline** principle skills.

## Illegal states unrepresentable

Go has no sum types. The tools are small defined types, so values can't be mixed up, and unexported fields behind a constructor, so invalid values can't be built.

```go
// Don't. Any string compiles; every function re-checks or trusts blindly.
func Transfer(from, to string, amountCents int64) error

// Do. Parse once at the boundary; downstream signatures state what they need.
type AccountID string

func ParseAccountID(s string) (AccountID, error) {
	if len(s) != 12 {
		return "", fmt.Errorf("account id %q: want 12 chars", s)
	}
	return AccountID(s), nil
}

type Cents int64

func Transfer(from, to AccountID, amount Cents) error
```

When a struct has invariants, close it:

```go
// Don't. A half-filled Client compiles and fails at first use.
type Client struct {
	BaseURL string
	HTTP    *http.Client
}

// Do. Unexported fields; the constructor is the only door.
type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) (*Client, error) {
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("client: invalid base url %q", baseURL)
	}
	return &Client{
		baseURL: u.String(),
		http:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}
```

Reach for the constructor only when an invariant exists. Otherwise prefer a useful zero value (below).

## Enums

```go
// Don't. Stringly-typed states: typos compile, any value passes.
func SetState(s string) error // "active", "Active", "actve"

// Do. Defined type, iota constants, zero reserved for invalid.
type State int

const (
	StateInvalid State = iota
	StatePending
	StateActive
	StateClosed
)
```

Start real values at non-zero so an uninitialized `State` is visibly wrong; start at zero only when zero is a genuine default. `switch` is not exhaustive: list every constant and make the default arm fail loudly, `fmt.Errorf("unhandled state %v", s)` in logic, a placeholder in formatting:

```go
func (s State) String() string {
	switch s {
	case StatePending:
		return "pending"
	case StateActive:
		return "active"
	case StateClosed:
		return "closed"
	default:
		return fmt.Sprintf("State(%d)", int(s))
	}
}
```

## Consumer-side interfaces

Interfaces belong in the package that uses them. A producer-side interface forces every consumer and fake to carry the full method set; the consumer's own interface is exactly as big as what it calls.

```go
// Don't. Producer exports the interface and returns it; fakes must
// implement all of it, users depend on all of it.
package store

type Store interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Put(ctx context.Context, key string, val []byte) error
}

func New() Store

// Do. Producer returns the concrete type.
package store

func New() *Client

// Consumer declares only what it calls. *store.Client satisfies it
// implicitly; so does a three-line test fake.
package archive

type getter interface {
	Get(ctx context.Context, key string) ([]byte, error)
}

func Run(ctx context.Context, g getter) error
```

Don't define an interface before something consumes it; a producer-side interface added "for mocking" is the same smell.

## Error wrapping

```go
// Don't. %v severs the chain; "failed to" noise compounds up the stack.
return fmt.Errorf("failed to load config: %v", err)

// Do. Terse lowercase context; %w keeps errors.Is/As working.
return fmt.Errorf("load config: %w", err)
```

Chains read newest-to-oldest: `load config: open /etc/app.toml: no such file or directory`. Wrap only where context adds information. `%w` is API: callers may depend on the inner error; at trust boundaries use `%v` or a fresh error so internals stay private.

Sentinel for identity, typed error for data:

```go
// Package store:
var ErrNotFound = errors.New("not found")

type QuotaError struct{ Used, Limit int64 }

func (e *QuotaError) Error() string {
	return fmt.Sprintf("quota exceeded: %d of %d", e.Used, e.Limit)
}

// Callers:
if errors.Is(err, store.ErrNotFound) { /* identity */ }

var qe *store.QuotaError
if errors.As(err, &qe) { /* qe.Used, qe.Limit */ }
```

Never return a typed nil as `error`; inside an interface it is non-nil:

```go
// Don't. Callers see err != nil even when qe is nil.
func check(used, limit int64) error {
	var qe *QuotaError
	if used > limit {
		qe = &QuotaError{Used: used, Limit: limit}
	}
	return qe
}

// Do. Literal nil on success.
func check(used, limit int64) error {
	if used > limit {
		return &QuotaError{Used: used, Limit: limit}
	}
	return nil
}
```

Don't let panics cross a package boundary: return errors; `recover` only at a goroutine's top frame.

## Useful zero values

```go
// Don't
mu := new(sync.Mutex)
buf := bytes.NewBuffer([]byte{})

// Do
var mu sync.Mutex
var buf bytes.Buffer
```

Design your own types the same way; initialize lazily inside methods:

```go
type Registry struct {
	mu sync.Mutex
	m  map[string]Handler
}

func (r *Registry) Register(name string, h Handler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.m == nil {
		r.m = make(map[string]Handler)
	}
	r.m[name] = h
}
```

`var r Registry` just works. Add a `NewX` only to enforce an invariant. A struct holding a `sync.Mutex` must not be copied after first use: pass `*Registry`, never a copy.

## Goroutine lifetimes

Every goroutine needs a known exit and someone who waits for it. A goroutine nothing waits on leaks memory, loses errors, and outlives its request.

```go
// Don't. Unbounded, no error path, no cancellation, outlives the caller.
for _, u := range urls {
	go fetch(u)
}

// Do. Bounded fan-out; first error cancels the siblings; Wait pins the lifetime.
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(8)
for _, u := range urls {
	g.Go(func() error {
		return fetch(ctx, u)
	})
}
if err := g.Wait(); err != nil {
	return err
}
```

In modules declaring go 1.22+, loop variables are per-iteration; don't write `u := u` copies. For a lone background goroutine, put the start and the stop in the same place: pass a context and hold a `sync.WaitGroup` or done channel that `Close`/`Shutdown` waits on.

## Channel ownership

Exactly one goroutine owns a channel: it creates it, writes to it, and closes it. Receivers only `range`; a receiver closing a channel it doesn't own turns any late send into a panic.

```go
// Writer closes; returning <-chan encodes ownership in the type.
func produce(ctx context.Context, jobs []Job) <-chan Result {
	out := make(chan Result)
	go func() {
		defer close(out)
		for _, j := range jobs {
			if ctx.Err() != nil { // check before the work: a select's send
				return // value is evaluated on entry, so it can't skip run(j)
			}
			select {
			case out <- run(j):
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}
```

A receiver that stops early must cancel or drain; otherwise the producer blocks forever on the unbuffered send:

```go
ctx, cancel := context.WithCancel(ctx)
defer cancel() // unblocks the producer if we break out early
for r := range produce(ctx, jobs) { /* ... */ }
```

Channels are unbuffered or size 1. Any other capacity is a claim about throughput that needs a measurement, not a guess like 64.

## Context discipline

`ctx context.Context` is the first parameter, named `ctx`. Never store it in a struct; a stored context smuggles one caller's lifetime into shared state.

```go
// Don't
type Poller struct {
	ctx context.Context
}

// Do
func (p *Poller) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-p.tick.C:
			p.poll(ctx)
		}
	}
}
```

Always release derived contexts:

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel() // releases the timer and parent link now; forgetting it holds them until the deadline or the parent ends
```

Context values are for request-scoped cross-cutting data (trace ids, auth principal), never ordinary parameters; if a function needs a value, put it in the signature.

## Generics restraint

A type parameter earns its keep when you'd otherwise write the exact same body for different types: slice/map/channel helpers, containers. If the body only calls methods on the value, an interface is simpler and usually no slower.

```go
// Don't. The body only calls a method.
func Drain[T io.Reader](r T) ([]byte, error) { return io.ReadAll(r) }

// Do
func Drain(r io.Reader) ([]byte, error) { return io.ReadAll(r) }
```

If the implementation differs per type, that's an interface with different method implementations, not a type parameter. Before writing a generic helper, check `slices`, `maps`, and `cmp`; most of the obvious ones ship in the standard library.

## Aliasing

A slice is a header over shared memory; a map is a pointer to shared data. Storing or returning one hands out write access to your internals.

```go
// Don't. Stores the caller's backing array; their later append/mutation
// corrupts r's state.
func (r *Recorder) SetTags(tags []string) {
	r.tags = tags
}

// Do. Clone at the ownership boundary. Same for maps: maps.Clone.
func (r *Recorder) SetTags(tags []string) {
	r.tags = slices.Clone(tags)
}
```

`append` on a subslice writes through until capacity forces a reallocation, so corruption is capacity-dependent and intermittent:

```go
a := []int{1, 2, 3, 4}
b := append(a[:2], 99) // a is now [1 2 99 4]; b aliases a
```

If a subslice must not grow into its parent, cap it: `a[:2:2]`.

## Options ladder

Plain args, then a config struct, then functional options. Each step is machinery; take it only when the previous step fails.

```go
// Don't. Option machinery for two values every caller sets anyway.
type Option func(*Client)

func WithTimeout(d time.Duration) Option { return func(c *Client) { c.timeout = d } }
func WithRetries(n int) Option           { return func(c *Client) { c.retries = n } }

func New(addr string, opts ...Option) *Client

// Do. Required values are plain args.
func New(addr string, timeout time.Duration, retries int) *Client
```

Several optional knobs with usable defaults: a config struct whose zero value is the default. The trade-off of this rung: once 0 means 30s, "no timeout" needs its own representation.

```go
type Config struct {
	Timeout time.Duration // 0 = 30s
	Retries int           // 0 = none
}

func New(addr string, cfg Config) *Client
```

Functional options earn their keep when most callers pass none, the list is long and growing, or an option can fail (the option returns `error`). Options take parameters (`WithFailFast(enable bool)`), not presence (`WithFailFastEnabled()`), so callers can compute them.

## defer cleanup

`defer` the release on the line after a successful acquire; every later `return` is then covered. errcheck (behind the `golangci-lint` gate) flags bare `defer f.Close()`: read-only closes discard the error explicitly, writers capture it.

```go
// Don't. The early return leaks the handle.
f, err := os.Open(path)
if err != nil {
	return err
}
data, err := parse(f)
if err != nil {
	return err // f never closed
}
f.Close()

// Do. Read-only: discard the Close error explicitly.
f, err := os.Open(path)
if err != nil {
	return err
}
defer func() { _ = f.Close() }()
```

Writers don't discard it: `Close` can surface writeback errors the writes didn't (EIO, NFS):

```go
func write(path string, data []byte) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, f.Close()) }()
	_, err = f.Write(data)
	return err
}
```

## slog

```go
// Don't. Flat string; nothing downstream can filter or query it.
log.Printf("login failed user=%s ip=%s", user, ip)

// Do. Structured attrs; the Context variant lets handlers attach trace ids.
slog.InfoContext(ctx, "login failed", "user", user, "ip", ip)
```

Attrs repeated across calls get factored out once; hot paths use `LogAttrs` with typed attrs to avoid allocations:

```go
logger := slog.With("request_id", reqID)
logger.InfoContext(ctx, "cache miss", "key", key)

logger.LogAttrs(ctx, slog.LevelDebug, "enqueue", slog.Int("depth", depth))
```

Handler choice is `main`'s decision, made once:

```go
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
```

## Package layout

The package name is read at every call site; name it for what it provides.

```text
// Don't
util/               // grab bag; util.Retry says nothing about ownership
common/, helpers/
store.StoreClient   // stutter

// Do
internal/retry/     // retry.Do reads clean; internal/ keeps it out of the public API
internal/ratelimit/
store.Client
```

A `util` package accretes unrelated code and every package ends up importing it. Split by domain instead, under `internal/` unless external users are the point. If two packages can only be used together, merge them.

## Table-driven tests

One test function, a slice of named cases, `t.Run` per case. Adding a case is one line, and failures name the case.

```go
// Don't: TestParseValid, TestParseEmpty, TestParseTooShort,
// each a copy-pasted body.

// Do
func TestParseAccountID(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    AccountID
		wantErr bool
	}{
		{name: "valid", in: "ABCDEF123456", want: "ABCDEF123456"},
		{name: "empty", in: "", wantErr: true},
		{name: "too short", in: "ABC", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAccountID(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ParseAccountID(%q) = %q, want error", tt.in, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseAccountID(%q): %v", tt.in, err)
			}
			if got != tt.want {
				t.Errorf("ParseAccountID(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
```

Helpers call `t.Helper()` so failures point at the caller, and `t.Cleanup` instead of `defer`; a `defer` in a helper runs when the helper returns, not when the test ends:

```go
func newTestServer(t *testing.T) *Server {
	t.Helper()
	srv, err := NewServer("localhost:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { srv.Close() })
	return srv
}
```
