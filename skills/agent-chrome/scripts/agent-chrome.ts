#!/usr/bin/env bun
// Runs browser workers in the dedicated agent Chrome. See ../SKILL.md.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname, platform, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const CHROME_DEVTOOLS_MCP = "chrome-devtools-mcp@1.14.0";
const SERVER = "chrome-devtools";
// Screenshots, select_page, and Lighthouse bring the minimized window to the front and take focus.
// Reading pages never needs upload_file.
const DISALLOWED_TOOLS = ["take_screenshot", "select_page", "lighthouse_audit", "upload_file"];
// The coordinator's Bash calls stop at 600 seconds. The slot wait gets whatever this budget leaves
// after the worker's timeout and two mutex waits; starting, minimizing, and closing Chrome take the rest.
const RUN_BUDGET_SECONDS = 525;
const MAX_TIMEOUT_SECONDS = 300;
const START_SECONDS = 20;
const CLOSE_SECONDS = 15;
const MUTEX_SECONDS = 30;
const SCRIPT = import.meta.path;

const argv = process.argv.slice(2);
const PROFILE = argv[0] === "--profile" ? argv.splice(0, 2)[1] : "default";
const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;
if (argv[0]?.startsWith("--profile=")) {
  console.error("Write --profile <name> with a space, before the command.");
  process.exit(2);
}
if (!PROFILE || !PROFILE_NAME.test(PROFILE)) {
  console.error("--profile comes first and takes a name of lowercase letters, digits, and hyphens, such as marketplace.");
  process.exit(2);
}

// Each profile is its own Chrome with its own locks, so runs on different profiles do not wait for each other.
// Its mutex and worker-slot ports stay below 49152, because Windows reserves blocks of the dynamic range above
// it (one on the desktop covered 49871-49970) and binding there fails. Two names in the same bucket share
// these locks and so wait for each other; nothing else breaks.
// Counting always probes every slot up to the hard limits, so runs started with different limits still see
// each other's workers.
const WORKERS_LIMIT = 5;
const TOTAL_LIMIT = 12;
const MAX_WORKERS = Number(process.env.AGENT_CHROME_MAX_WORKERS ?? 4);
if (!Number.isInteger(MAX_WORKERS) || MAX_WORKERS < 1 || MAX_WORKERS > WORKERS_LIMIT) {
  console.error(`AGENT_CHROME_MAX_WORKERS takes a whole number from 1 to ${WORKERS_LIMIT}.`);
  process.exit(2);
}
// Every worker also holds one of MAX_TOTAL machine-wide slots, which bounds the browser's load across
// profiles. Measured on the 4-vCPU, 8 GB VM: 9 workers across 3 profiles all finished with 2.1 GB free.
const MAX_TOTAL = Number(process.env.AGENT_CHROME_MAX_TOTAL ?? 8);
if (!Number.isInteger(MAX_TOTAL) || MAX_TOTAL < 1 || MAX_TOTAL > TOTAL_LIMIT) {
  console.error(`AGENT_CHROME_MAX_TOTAL takes a whole number from 1 to ${TOTAL_LIMIT}.`);
  process.exit(2);
}
const PROFILE_HASH = PROFILE === "default" ? 0 : 1 + [...PROFILE].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
// The lock ports span LOCK_BASE - 12 to LOCK_BASE + 1198. Below 1024 Linux refuses them without root.
const LOCK_BASE = Number(process.env.AGENT_CHROME_LOCK_PORT ?? 47913);
if (!Number.isInteger(LOCK_BASE) || LOCK_BASE - TOTAL_LIMIT < 1024 || LOCK_BASE + 199 + 200 * WORKERS_LIMIT >= 49152) {
  console.error(`AGENT_CHROME_LOCK_PORT takes a whole number from ${1024 + TOTAL_LIMIT} to ${49151 - 199 - 200 * WORKERS_LIMIT}.`);
  process.exit(2);
}
const LOCK_PORT = LOCK_BASE + (PROFILE_HASH % 199);
const slotPort = (slot: number) => LOCK_PORT + 200 * (slot + 1);
const totalSlotPort = (slot: number) => LOCK_BASE - 1 - slot;

// The signed-in agent Chrome lives on one machine. Elsewhere a fresh or stale profile would browse
// without the user's sign-ins, so runs there go to that machine through T3 instead. See ../SKILL.md.
// The fallback host runs its own agent Chrome, with its own sign-ins, only when the main host cannot
// be reached. An empty value turns it off.
const AGENT_CHROME_HOST = process.env.AGENT_CHROME_HOST || "redwood";
const FALLBACK_HOST = process.env.AGENT_CHROME_FALLBACK_HOST ?? "colton-desktop";
const isHost = (name: string) => Boolean(name) && hostname().toLowerCase() === name.toLowerCase();
const onAgentChromeHost = isHost(AGENT_CHROME_HOST);
const fallback = FALLBACK_HOST && !onAgentChromeHost && FALLBACK_HOST.toLowerCase() !== AGENT_CHROME_HOST.toLowerCase() ? FALLBACK_HOST : undefined;
const handOff = {
  status: "hand_off",
  host: AGENT_CHROME_HOST,
  ...(fallback ? { fallback } : {}),
  detail: `The agent Chrome lives on ${AGENT_CHROME_HOST}, not ${hostname()}. Hand the run to ${AGENT_CHROME_HOST} through T3.${
    fallback ? ` When ${AGENT_CHROME_HOST} cannot be reached, run it on ${fallback} with --fallback.` : ""
  }`,
};

const onFallbackHost = !onAgentChromeHost && isHost(FALLBACK_HOST);

// A run on the fallback host needs --fallback, so it happens only after the main host could not be reached.
function mayRunHere(useFallback: boolean): boolean {
  if (!useFallback) return onAgentChromeHost;
  if (onAgentChromeHost || onFallbackHost) return true;
  throw new Error(`--fallback runs only on the fallback host${FALLBACK_HOST ? `, ${FALLBACK_HOST}` : ", which is turned off"}. This is ${hostname()}.`);
}

const os = platform();

// On redwood, Chrome runs in a Windows 11 VM (~/services/agent-chrome-win there), because Akamai's bot
// manager refused every Linux Chrome from that network that was tried, while it serves Windows Chrome.
// The script drives the VM over SSH with windows-vm/agent.ps1, and reaches each profile's fixed debugging
// port through an SSH tunnel on the same redwood loopback port. Two names whose hashes share a port cannot
// both run Chrome at once; the second one's start times out.
const VM_DIR = join(homedir(), "services", "agent-chrome-win");
const VM_KEY = join(VM_DIR, "secrets", "id_ed25519");
const inVm = os === "linux" && existsSync(VM_KEY);
const VM_PORT = 9300 + (PROFILE_HASH % 997);
const VM_VIEWER_PORT = 6080;
const VM_SSH_OPTIONS = [
  "-o", "BatchMode=yes", "-o", "LogLevel=ERROR", "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10",
  "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
  "-o", `UserKnownHostsFile=${join(VM_DIR, "secrets", "known_hosts")}`, "-i", VM_KEY,
];
const VM_SSH = ["ssh", ...VM_SSH_OPTIONS, "-p", "2242"];
// A hung command in the VM must not hold the profile's mutex past the coordinator's limit.
const VM_COMMAND_SECONDS = 60;

function vmShell(command: string): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync([...VM_SSH, "agent@127.0.0.1", command], { timeout: VM_COMMAND_SECONDS * 1000 });
}

let helperSynced = false;

function vm(command: "launch" | "running" | "owns-port" | "kill", port?: number): string {
  if (!helperSynced) {
    syncVmHelper();
    helperSynced = true;
  }
  const result = vmShell(
    `powershell -NoProfile -ExecutionPolicy Bypass -File C:\\agent-chrome\\agent.ps1 ${command} ${PROFILE}${port ? ` ${port}` : ""}`,
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `The Windows VM did not run "${command}" (exit ${result.exitCode ?? "timeout"}): ${result.stderr?.toString().trim() || "no output"}. Check it with: systemctl --user status agent-chrome-win`,
    );
  }
  return result.stdout?.toString().trim() ?? "";
}

// Copies windows-vm/agent.ps1 into the VM when the copy there differs or is missing, so a fresh VM and a
// profile update both get it. It lands under a temporary name first, because two profiles can sync at once.
const VM_HELPER = join(import.meta.dir, "windows-vm", "agent.ps1");
function syncVmHelper(): void {
  const local = new Bun.CryptoHasher("sha256").update(readFileSync(VM_HELPER)).digest("hex");
  const remote = vmShell("certutil -hashfile C:\\agent-chrome\\agent.ps1 SHA256").stdout?.toString() ?? "";
  if (remote.toLowerCase().includes(local)) return;
  const temporary = `agent.ps1.${process.pid}`;
  const prepared = vmShell("if not exist C:\\agent-chrome\\profiles mkdir C:\\agent-chrome\\profiles");
  const copied = prepared.exitCode === 0
    ? Bun.spawnSync(["scp", ...VM_SSH_OPTIONS, "-P", "2242", VM_HELPER, `agent@127.0.0.1:C:/agent-chrome/${temporary}`], { timeout: VM_COMMAND_SECONDS * 1000 })
    : prepared;
  const moved = copied.exitCode === 0 ? vmShell(`move /y C:\\agent-chrome\\${temporary} C:\\agent-chrome\\agent.ps1`) : copied;
  if (moved.exitCode !== 0) {
    throw new Error(`Could not copy agent.ps1 into the Windows VM: ${moved.stderr?.toString().trim() || "timed out"}. Check it with: systemctl --user status agent-chrome-win`);
  }
}

// The tunnel lives as long as the profile's Chrome, which several workers may share, so it runs detached
// from the process that opens it. Only a caller that holds the profile's mutex opens or closes it, and
// closes it only with no worker running, because otherwise it can belong to a running worker.
async function openTunnel(): Promise<void> {
  if (await listening(VM_PORT)) return;
  Bun.spawnSync([
    "setsid", "-f", ...VM_SSH, "-o", "ExitOnForwardFailure=yes", "-N",
    "-L", `127.0.0.1:${VM_PORT}:127.0.0.1:${VM_PORT}`, "agent@127.0.0.1",
  ], { stdio: ["ignore", "ignore", "ignore"] });
  await poll(10, 200, async () => ((await listening(VM_PORT)) ? true : undefined));
}

function closeTunnels(): void {
  Bun.spawnSync(["pkill", "-f", "--", `-L 127.0.0.1:${VM_PORT}:127.0.0.1:${VM_PORT} `]);
}

const profileDir = inVm
  ? `C:\\agent-chrome\\profiles\\${PROFILE}`
  : (PROFILE === "default" && process.env.AGENT_CHROME_PROFILE) || profileDirFor(PROFILE);

// An empty or relative base directory would put the profile under the current directory; the XDG spec says to ignore it.
function absoluteEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && isAbsolute(value) ? value : undefined;
}

// The default profile keeps the folder it always had, so its sign-ins carry over. Named profiles sit
// beside it, each a separate Chrome user data folder, so one profile's worker cannot reach another's cookies.
function profileDirFor(name: string): string {
  const base =
    os === "win32"
      ? (absoluteEnv("LOCALAPPDATA") ?? join(homedir(), "AppData", "Local"))
      : os === "darwin"
        ? join(homedir(), "Library", "Application Support")
        : (absoluteEnv("XDG_DATA_HOME") ?? join(homedir(), ".local", "share"));
  return name === "default" ? join(base, "agent-chrome") : join(base, "agent-chrome-profiles", name);
}

function chromePath(): string {
  const candidates =
    os === "win32"
      ? [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
          .filter((base): base is string => Boolean(base))
          .map((base) => join(base, "Google", "Chrome", "Application", "chrome.exe"))
      : os === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/opt/google/chrome/chrome"];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Google Chrome not found. Looked in: ${candidates.join(", ")}`);
  return found;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function poll<T>(seconds: number, interval: number, check: () => Promise<T | undefined> | T | undefined): Promise<T | undefined> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result !== undefined) return result;
    await Bun.sleep(interval);
  }
  return undefined;
}

type Chrome = { base: string; browserSocket: string };

// Chrome writes DevToolsActivePort into the profile it runs. Matching its WebSocket path against
// /json/version proves the listener is this profile's Chrome rather than another browser on that port.
// status passes openTunnel=false, because it holds no lock and so must not create a VM tunnel.
async function endpoint(openTunnelIfNeeded = true): Promise<Chrome | undefined> {
  if (inVm) return vmEndpoint(openTunnelIfNeeded);
  const file = join(profileDir, "DevToolsActivePort");
  if (!existsSync(file)) return undefined;
  const [port, path] = readFileSync(file, "utf8").split(/\r?\n/);
  if (!port || !path) return undefined;
  const base = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) });
    const { webSocketDebuggerUrl } = (await response.json()) as { webSocketDebuggerUrl?: string };
    return webSocketDebuggerUrl?.endsWith(path) ? { base, browserSocket: webSocketDebuggerUrl } : undefined;
  } catch {
    return undefined;
  }
}

// Chrome in the VM writes no DevToolsActivePort for a fixed port, so the VM checks that this profile's
// browser process owns the listener instead. That check costs an SSH call, so it runs only once the port answers.
// A tunnel whose SSH connection died still listens, so the first lookup in a process that may open
// tunnels replaces one that answers nothing while this profile's Chrome holds its debugging port.
let tunnelChecked = false;

async function vmEndpoint(openTunnelIfNeeded: boolean): Promise<Chrome | undefined> {
  if (openTunnelIfNeeded) await openTunnel();
  else if (!(await listening(VM_PORT))) return undefined;
  const base = `http://127.0.0.1:${VM_PORT}`;
  const lookup = async () => {
    try {
      const response = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) });
      return ((await response.json()) as { webSocketDebuggerUrl?: string }).webSocketDebuggerUrl;
    } catch {
      return undefined;
    }
  };
  let browserSocket = await lookup();
  if (!browserSocket && openTunnelIfNeeded && !tunnelChecked) {
    tunnelChecked = true;
    if (vm("owns-port", VM_PORT) === "yes") {
      closeTunnels();
      await openTunnel();
      browserSocket = await lookup();
    }
  }
  tunnelChecked = true;
  if (!browserSocket) return undefined;
  return vm("owns-port", VM_PORT) === "yes" ? { base, browserSocket } : undefined;
}

// The path has to end where the argument ends, so a profile such as agent-chrome-old does not count.
const profileArgument = new RegExp(
  `--user-data-dir="?${profileDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}("|\\s|$)`,
  os === "win32" ? "i" : "",
);

function profileProcessRunning(): boolean {
  if (inVm) return vm("running") === "yes";
  if (os === "win32") {
    return Bun.spawnSync([
      "powershell", "-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { $_.CommandLine }",
    ])
      .stdout.toString()
      .split("\n")
      .some((line) => profileArgument.test(line));
  }
  // Only Chrome's own processes count; a shell or editor can have the profile path in its command line too.
  const chromeBinary = os === "darwin" ? "/Google Chrome.app/Contents/" : "/opt/google/chrome/";
  return Bun.spawnSync(["ps", "-axww", "-o", "command="])
    .stdout.toString()
    .split("\n")
    .some((line) => line.includes(chromeBinary) && profileArgument.test(line));
}

function powershell(script: string): void {
  const result = Bun.spawnSync(["powershell", "-NoProfile", "-NonInteractive", "-Command", script]);
  if (result.exitCode !== 0) throw new Error(`PowerShell failed: ${result.stderr.toString().trim()}`);
}

const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`;
// Start-Process joins its argument list with spaces, so a value containing a space needs its own quotes.
const startProcessArgument = (arg: string) =>
  psQuote(!arg.includes(" ") ? arg : arg.startsWith("--") ? arg.replace(/=(.*)$/, '="$1"') : `"${arg}"`);
const startProcess = (file: string, args: string[]) =>
  `Start-Process -FilePath ${psQuote(file)} -ArgumentList @(${args.map(startProcessArgument).join(",")})`;

// debugging=false opens a normal, visible window for the user to sign in, with no debugging port that
// sign-in pages such as Google's may detect.
function launch(debugging: boolean): void {
  if (inVm) {
    syncVmHelper();
    vm("launch", debugging ? VM_PORT : undefined);
    return;
  }
  const args = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(debugging
      ? [
          // Port 0 lets Chrome pick a free port and record it in DevToolsActivePort.
          "--remote-debugging-port=0",
          // With a debugging port open, Chrome otherwise reports navigator.webdriver, which sites use
          // to challenge or block automated browsers.
          "--disable-blink-features=AutomationControlled",
          // A minimized window otherwise throttles background tabs until navigations take tens of seconds.
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-background-timer-throttling",
        ]
      : []),
    ...(debugging ? ["about:blank"] : []),
  ];
  if (os === "win32") {
    if (!debugging) return powershell(startProcess(chromePath(), args));
    // Chrome restores its last window state over a minimized start, and it activates either way,
    // so minimize what appears and hand focus back to the window the user had.
    powershell(`Add-Type -Namespace AgentChrome -Name User32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
'@
$prev = [AgentChrome.User32]::GetForegroundWindow()
$p = ${startProcess(chromePath(), args)} -WindowStyle Minimized -PassThru
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) { $q = Get-Process -Id $p.Id -ErrorAction SilentlyContinue; if ($q -and $q.MainWindowHandle -ne 0) { break }; Start-Sleep -Milliseconds 50 }
$h = (Get-Process -Id $p.Id -ErrorAction SilentlyContinue).MainWindowHandle
if ($h) {
  if (-not [AgentChrome.User32]::IsIconic($h)) { [AgentChrome.User32]::ShowWindowAsync($h, 6) | Out-Null; Start-Sleep -Milliseconds 200 }
  if ($prev -ne [IntPtr]::Zero -and $prev -ne $h -and [AgentChrome.User32]::GetForegroundWindow() -eq $h) { [AgentChrome.User32]::SetForegroundWindow($prev) | Out-Null }
}`);
  } else if (os === "darwin") {
    const opened = Bun.spawnSync(["open", ...(debugging ? ["-g", "-j"] : []), "-na", "Google Chrome", "--args", ...args]);
    if (opened.exitCode !== 0) throw new Error(`open could not start Google Chrome: ${opened.stderr.toString().trim()}`);
  } else {
    // xdotool can minimize only X11 windows, so this Chrome runs under X11, or XWayland in a Wayland session.
    const minimize = debugging && Boolean(Bun.which("xdotool")) && Boolean(process.env.DISPLAY);
    const platformArgs = minimize ? ["--ozone-platform=x11"] : [];
    Bun.spawn(["setsid", "-f", chromePath(), ...platformArgs, ...args], { stdio: ["ignore", "ignore", "ignore"] });
    if (minimize) minimizeOnX11();
  }
}

// The VM's screen, through dockur's web viewer on redwood loopback, which tailscale serve publishes to the
// tailnet; the tailnet policy lets only the owner reach redwood's ports. It shows every profile's Chrome.
function viewerUrl(): string {
  try {
    const status = JSON.parse(Bun.spawnSync(["tailscale", "status", "--json"]).stdout.toString()) as { Self?: { DNSName?: string } };
    const name = status.Self?.DNSName?.replace(/\.$/, "");
    if (name) return `https://${name}:${VM_VIEWER_PORT}/`;
  } catch {}
  return `http://127.0.0.1:8007/ (tunnel port 8007 from ${hostname()})`;
}

function minimizeOnX11(): void {
  const chrome = chromePath();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    // The browser process is the Chrome binary itself with this profile; its helpers carry --type=,
    // and the crash handler is a different binary.
    const browserPid = Bun.spawnSync(["ps", "-axww", "-o", "pid=,command="])
      .stdout.toString()
      .split("\n")
      .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
      .find((match) => match?.[2]?.startsWith(`${chrome} `) && profileArgument.test(match[2]) && !match[2].includes("--type="))?.[1];
    const windows = browserPid
      ? Bun.spawnSync(["xdotool", "search", "--onlyvisible", "--pid", browserPid]).stdout.toString().split("\n").filter(Boolean)
      : [];
    if (windows.length > 0) {
      for (const window of windows) Bun.spawnSync(["xdotool", "windowminimize", window]);
      return;
    }
    Bun.sleepSync(100);
  }
}

// The caller holds the mutex and has found no debugging endpoint.
async function startChrome(): Promise<Chrome> {
  if (profileProcessRunning()) {
    throw new Error(
      `The agent Chrome (${profileDir}) is open without its debugging endpoint, usually for sign-in. Close that Chrome window when signing in is done, then run again.`,
    );
  }
  launch(true);
  const started = await poll(START_SECONDS, 250, endpoint);
  if (started) return started;
  // A Chrome that comes up after the deadline would otherwise keep its debugging port open, unwatched.
  if (inVm) {
    vm("kill");
    closeTunnels();
  }
  throw new Error(`The agent Chrome did not open its debugging endpoint within ${START_SECONDS} seconds.`);
}

// Chrome closes once no worker uses it, because any local process can use its unauthenticated debugging
// port to read every cookie while it is open.
async function closeChrome(chrome: Chrome): Promise<boolean> {
  try {
    const socket = new WebSocket(chrome.browserSocket);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
    socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
  } catch {
    // In the VM the process can still be stopped below.
    if (!inVm) return false;
  }
  // Wait for the process itself, so the next run does not find the profile still in use. In the VM each
  // check is an SSH call, so it checks less often, and a Chrome that ignores Browser.close is stopped.
  let closed = (await poll(CLOSE_SECONDS, inVm ? 1000 : 250, () => (profileProcessRunning() ? undefined : true))) ?? false;
  if (inVm && !closed) {
    vm("kill");
    closed = !profileProcessRunning();
  }
  return closed;
}

type Target = { id: string; type: string; url: string; title: string };

async function pages(base: string): Promise<Target[]> {
  const response = await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(5000) });
  return ((await response.json()) as Target[]).filter((target) => target.type === "page");
}

// Up to MAX_WORKERS workers share one profile's Chrome, each holding a worker slot. LOCK_PORT is the
// profile's mutex: starting Chrome, closing it, signing in, and close take it, so the last worker out
// closes Chrome only when no other worker holds a slot, and a worker that joins meanwhile waits and
// then starts a new one. A listening port is a lock because the OS releases it when the holder exits,
// however it exits.
type Lock = { stop(closeActiveConnections?: boolean): void };

// A slot port the OS will not bind for another reason, such as a reserved range, is skipped like a held
// one; the mutex has no substitute, so that failure is reported.
function tryListen(port: number, required: boolean): Lock | undefined {
  try {
    return Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } });
  } catch (error) {
    if ((error as { code?: string }).code === "EADDRINUSE" || !required) return undefined;
    throw new Error(`Cannot take the agent-chrome lock on 127.0.0.1:${port}: ${message(error)}. Set AGENT_CHROME_LOCK_PORT to a port with a free range from 12 below it to 1198 above it.`);
  }
}

const tryLock = () => tryListen(LOCK_PORT, true);

async function takeMutex(seconds: number): Promise<Lock | undefined> {
  return poll(seconds, 250, tryLock);
}

function tryAny(ports: number[]): Lock | undefined {
  for (const port of ports) {
    const lock = tryListen(port, false);
    if (lock) return lock;
  }
  return undefined;
}

const profileSlots = (count: number) => Array.from({ length: count }, (_, slot) => slotPort(slot));
const totalSlots = (count: number) => Array.from({ length: count }, (_, slot) => totalSlotPort(slot));

// A worker takes a machine-wide slot and then a profile slot, and gives the machine-wide one back when the
// profile is full. Taking the profile slot last keeps a waiting run from ever holding one, because the last
// worker out closes Chrome only when no profile slot is held.
function trySlot(): Lock | undefined {
  const totalSlot = tryAny(totalSlots(MAX_TOTAL));
  if (!totalSlot) return undefined;
  const profileSlot = tryAny(profileSlots(MAX_WORKERS));
  if (!profileSlot) {
    totalSlot.stop(true);
    return undefined;
  }
  return {
    stop(closeActiveConnections) {
      profileSlot.stop(closeActiveConnections);
      totalSlot.stop(closeActiveConnections);
    },
  };
}

async function countListening(ports: number[]): Promise<number> {
  return (await Promise.all(ports.map(listening))).filter(Boolean).length;
}

const workersRunning = () => countListening(profileSlots(WORKERS_LIMIT));
const workersAllProfiles = () => countListening(totalSlots(TOTAL_LIMIT));

async function listening(port: number): Promise<boolean> {
  try {
    const socket = await Bun.connect({ hostname: "127.0.0.1", port, socket: { data() {} } });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

// On macOS and Linux this kills only the worker; its MCP server exits when the worker's pipe closes.
function stopWorker(pid: number): void {
  if (os === "win32") Bun.spawnSync(["taskkill", "/PID", String(pid), "/T", "/F"]);
  else process.kill(pid, "SIGKILL");
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Chrome and the watchdog start outside this script's process tree and process group, so they
// survive when the coordinator kills a run. The watchdog then stops the worker, closes Chrome, and
// removes the run's files.
function startWatchdog(workerPid: number, workDir: string): void {
  const args = [SCRIPT, "--profile", PROFILE, "watchdog", String(process.pid), String(workerPid), workDir];
  if (os === "win32") powershell(`${startProcess(process.execPath, args)} -WindowStyle Hidden`);
  // A short-lived helper starts the watchdog in a new session and exits, so the watchdog is
  // neither a descendant of this run nor in its process group.
  else {
    const helper = Bun.spawnSync([process.execPath, SCRIPT, "detach", ...args]);
    if (helper.exitCode !== 0) throw new Error(`Could not start the watchdog: ${helper.stderr.toString().trim()}`);
  }
}

async function watchdog(runPid: number, workerPid: number, workDir: string): Promise<void> {
  while (alive(runPid)) await Bun.sleep(1000);
  if (alive(workerPid)) stopWorker(workerPid);
  // A run that finished normally removed its folder after settling Chrome itself.
  if (!existsSync(workDir)) return;
  rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  // The dead run's slot is free now. Its Chrome stays open while other workers share it.
  const mutex = await takeMutex(120);
  if (!mutex) return;
  if ((await workersRunning()) === 0) await closeIdleChrome();
  mutex.stop(true);
}

// Closes the profile's Chrome and, in the VM, its tunnel. The caller holds the mutex and has checked
// that no worker holds a slot.
async function closeIdleChrome(): Promise<boolean> {
  const chrome = await endpoint();
  const closed = chrome ? await closeChrome(chrome).catch(() => false) : true;
  if (inVm) closeTunnels();
  return closed;
}

function configuredModel(): string | undefined {
  try {
    const settings = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");
    return (JSON.parse(readFileSync(settings, "utf8")) as { model?: string }).model;
  } catch {
    return undefined;
  }
}

// The worker reads untrusted pages, so it gets only what it needs to run and reach the model:
// nothing that ties it to the coordinator's session or carries other credentials.
const WORKER_ENV =
  /^(ANTHROPIC_\w+|API_TIMEOUT_MS|MCP_\w+|DISABLE_TELEMETRY|CLAUDE_CODE_(ENABLE_GATEWAY_MODEL_DISCOVERY|ATTRIBUTION_HEADER|DISABLE_\w+)|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_\w+|PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|USERPROFILE|HOMEDRIVE|HOMEPATH|HOME|USER|USERNAME|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|COMMONPROGRAMFILES|TEMP|TMP|TMPDIR|LANG|LC_\w+|TERM|SHELL)$/i;

type Outcome = Record<string, unknown>;

async function runWorker(brief: string, timeoutSeconds: number): Promise<Outcome> {
  const slotWait = RUN_BUDGET_SECONDS - timeoutSeconds - 2 * MUTEX_SECONDS;
  const slot = await poll(slotWait, 1000, trySlot);
  if (!slot) {
    const machineFull = (await workersAllProfiles()) >= MAX_TOTAL;
    const slots = machineFull ? `${MAX_TOTAL} worker slots across all profiles` : `${MAX_WORKERS} worker slots for this profile's agent Chrome`;
    return { status: "busy", detail: `Other runs held all ${slots} for over ${slotWait} seconds.` };
  }
  const startMutex = await takeMutex(MUTEX_SECONDS);
  if (!startMutex) return { status: "busy", detail: `Starting or closing this profile's agent Chrome took over ${MUTEX_SECONDS} seconds.` };
  let chrome: Chrome;
  try {
    const existing = await endpoint();
    chrome = existing ?? (await startChrome());
    // Tabs a session restored or a killed run left behind would otherwise sit beside the worker's. Only a
    // freshly started Chrome is cleaned, inside the mutex, because a shared one's tabs belong to its workers.
    if (!existing) {
      for (const page of (await pages(chrome.base)).slice(1)) {
        await fetch(`${chrome.base}/json/close/${page.id}`, { signal: AbortSignal.timeout(2000) }).catch(() => undefined);
      }
    }
  } catch (error) {
    return { status: "chrome_unavailable", detail: message(error) };
  } finally {
    startMutex.stop(true);
  }
  let workDir: string | undefined;
  let outcome: Outcome;
  try {
    workDir = mkdtempSync(join(tmpdir(), "agent-chrome-worker-"));
    outcome = await runInChrome(chrome.base, workDir, brief, timeoutSeconds);
  } catch (error) {
    outcome = { status: "error", detail: message(error) };
  }
  // The mutex is taken before the slot is released, so a worker that joins meanwhile is either counted
  // here or waits for the mutex and then starts a new Chrome. Without the mutex, this run's watchdog
  // closes Chrome once no worker uses it, because the run folder still exists.
  const closeMutex = await takeMutex(MUTEX_SECONDS);
  slot.stop(true);
  const others = await workersRunning();
  const closing = others > 0 ? { chromeClosed: false, chromeInUse: others } : closeMutex ? { chromeClosed: await closeIdleChrome() } : { chromeClosed: false, closedByWatchdog: true };
  closeMutex?.stop(true);
  if (!closeMutex && others === 0) return { ...outcome, ...closing };
  if (workDir) {
    try {
      rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  }
  return { ...outcome, ...closing };
}

async function runInChrome(base: string, workDir: string, brief: string, timeoutSeconds: number): Promise<Outcome> {
  // The worker gets its own temp directory, which is also the only place the MCP server writes
  // files, and an empty config directory, so it loads none of the user's instructions or settings.
  const tempDir = join(workDir, "tmp");
  const configDir = join(workDir, "config");
  mkdirSync(tempDir);
  mkdirSync(configDir);
  const mcpConfig = join(workDir, "mcp.json");
  writeFileSync(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        [SERVER]: {
          command: process.execPath,
          args: [
            "x", "--bun", CHROME_DEVTOOLS_MCP,
            "--browserUrl", base,
            "--no-usage-statistics",
            "--no-performance-crux",
            "--no-javascript-evaluation",
            "--no-category-performance",
            "--no-category-network",
            "--no-category-emulation",
            "--no-category-memory",
          ],
          env: {
            CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
            CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
            TEMP: tempDir,
            TMP: tempDir,
            TMPDIR: tempDir,
          },
        },
      },
    }),
  );

  const claude = process.env.CLAUDE_CODE_EXECPATH ?? Bun.which("claude");
  if (!claude) throw new Error("The claude CLI is not on PATH.");
  const model = configuredModel();
  const env: Record<string, string> = { CLAUDE_CONFIG_DIR: configDir, MAX_MCP_OUTPUT_TOKENS: "60000" };
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && WORKER_ENV.test(key)) env[key] = value;

  const worker = Bun.spawn(
    [
      claude, "-p",
      "--no-session-persistence",
      "--restricted",
      "--strict-mcp-config", "--mcp-config", mcpConfig,
      // Claude Code saves a large page snapshot to a file in the run folder and returns its path, so the
      // worker reads it back with Read and Grep; restricted mode keeps those tools inside that folder.
      "--tools", "ToolSearch,Read,Grep",
      "--allowedTools", `mcp__${SERVER},Read,Grep`,
      "--disallowedTools", DISALLOWED_TOOLS.map((tool) => `mcp__${SERVER}__${tool}`).join(","),
      "--permission-prompts", "none",
      "--output-format", "json",
      ...(model ? ["--model", model] : []),
    ],
    { cwd: workDir, env, stdin: new Blob([brief]), stdout: "pipe", stderr: "pipe" },
  );
  try {
    startWatchdog(worker.pid, workDir);
  } catch (error) {
    stopWorker(worker.pid);
    throw error;
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stopWorker(worker.pid);
  }, timeoutSeconds * 1000);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(worker.stdout).text(),
    new Response(worker.stderr).text(),
    worker.exited,
  ]);
  clearTimeout(timer);
  if (timedOut) return { status: "worker_timeout", timeoutSeconds };
  let report: unknown = stdout.trim();
  try {
    report = JSON.parse(stdout);
  } catch {}
  const failed = exitCode !== 0 || typeof report !== "object" || (report as { is_error?: boolean }).is_error === true;
  return {
    status: failed ? "worker_failed" : "finished",
    exitCode,
    worker: compactReport(report),
    ...(stderr.trim() ? { stderr: stderr.trim().slice(-2000) } : {}),
  };
}

// The worker's full output is mostly token accounting that coordinators never read and that a T3
// hand-off relays verbatim, so keep only the fields the skill uses.
function compactReport(report: unknown): unknown {
  if (typeof report !== "object" || report === null) return report;
  const { result, is_error, subtype, num_turns, duration_ms, total_cost_usd, permission_denials } = report as Record<string, unknown>;
  return { result, is_error, subtype, num_turns, duration_ms, total_cost_usd, permission_denials };
}

function parseRunOptions(args: string[]): { brief?: string; timeout: number; fallback: boolean } {
  const options = { brief: undefined as string | undefined, timeout: MAX_TIMEOUT_SECONDS, fallback: false };
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]];
    if (flag === "--fallback") {
      options.fallback = true;
      i -= 1;
      continue;
    }
    if (value === undefined) throw new Error(`${flag} needs a value.`);
    if (flag === "--brief") options.brief = value;
    else if (flag === "--timeout") {
      options.timeout = Number(value);
      if (!Number.isInteger(options.timeout) || options.timeout < 1 || options.timeout > MAX_TIMEOUT_SECONDS) {
        throw new Error(`--timeout takes whole seconds from 1 to ${MAX_TIMEOUT_SECONDS}.`);
      }
    } else if (flag === "--profile") {
      throw new Error("--profile comes before the command: agent-chrome.ts --profile <name> run --brief <file>.");
    } else throw new Error(`Unknown option ${flag}.`);
  }
  return options;
}

const USAGE = `Usage: agent-chrome.ts [--profile <name>] <command>
  --profile names the Chrome profile, each with its own sign-ins. It defaults to "default".
  run --brief <file | -> [--timeout <seconds>] [--fallback]
            Run one browser worker and print its outcome as JSON. --brief - reads the brief from stdin. The timeout defaults to ${MAX_TIMEOUT_SECONDS} seconds.
            --fallback runs it on the fallback host (AGENT_CHROME_FALLBACK_HOST, default colton-desktop) when the main host cannot be reached.
  signin
            Open the agent Chrome as a normal window, without debugging, for the user to sign in.
  status    Report whether the agent Chrome is open, whether it has its debugging port, whether a worker runs, and open tabs.
  close     Close an agent Chrome that a killed run left open with its debugging port.`;

async function main(command: string | undefined, rest: string[]): Promise<void> {
  switch (command) {
    case "run": {
      const options = parseRunOptions(rest);
      if (!options.brief) throw new Error("Pass the brief with --brief <file>.");
      // "-" reads the brief from stdin, which avoids paths that differ between Git Bash and Windows tools.
      if (options.brief === "-" && process.stdin.isTTY) throw new Error("--brief - reads the brief from stdin; pipe it in, such as with a quoted heredoc.");
      const brief = options.brief === "-" ? await Bun.stdin.text() : readFileSync(options.brief, "utf8");
      if (!brief.trim()) throw new Error(options.brief === "-" ? "The brief on stdin is empty." : `The brief file ${options.brief} is empty.`);
      console.log(JSON.stringify(mayRunHere(options.fallback) ? await runWorker(brief, options.timeout) : handOff, null, 2));
      return;
    }
    case "signin": {
      if (rest.length > 0) throw new Error(`signin takes no options. ${USAGE}`);
      // Signing in on the fallback host is the user's explicit request, so it needs no --fallback.
      if (!onAgentChromeHost && !onFallbackHost) throw new Error(`${handOff.detail} Sign in there.`);
      if (!tryLock() || (await workersRunning()) > 0) throw new Error("A worker is running. Run signin after it finishes.");
      const chrome = await endpoint();
      if (chrome) {
        if (!(await closeChrome(chrome))) throw new Error("The agent Chrome did not close.");
      } else if (profileProcessRunning()) {
        throw new Error("The agent Chrome is already open. Sign in there, then close its window.");
      }
      if (inVm) closeTunnels();
      launch(false);
      console.log(
        inVm
          ? `The agent Chrome (profile ${PROFILE}) is open for sign-in in ${hostname()}'s Windows VM. Open ${viewerUrl()} in a browser on the tailnet, sign in, then close that Chrome window.`
          : "The agent Chrome is open for sign-in. Sign in, then close its window.",
      );
      return;
    }
    case "status": {
      const chrome = await endpoint(false);
      const open = chrome ? (await pages(chrome.base).catch(() => [])).map(({ title, url }) => ({ title, url })) : [];
      const workers = await workersRunning();
      // Without a tunnel the VM itself says whether this profile's Chrome holds its debugging port.
      const debugging = Boolean(chrome) || (inVm && vm("owns-port", VM_PORT) === "yes");
      const allProfiles = await workersAllProfiles();
      console.log(JSON.stringify({ profile: PROFILE, profileDir, running: debugging || profileProcessRunning(), debugging, workerRunning: workers > 0, workers, workersAllProfiles: allProfiles, pages: open }, null, 2));
      return;
    }
    case "close": {
      if (!tryLock() || (await workersRunning()) > 0) throw new Error("A worker is running; the last worker closes Chrome when it finishes.");
      const debugging = Boolean(await endpoint());
      const closed = await closeIdleChrome();
      console.log(!debugging ? "The agent Chrome has no debugging port open." : closed ? "Closed the agent Chrome." : "The agent Chrome did not close.");
      return;
    }
    case "watchdog":
      return watchdog(Number(rest[0]), Number(rest[1]), String(rest[2]));
    case "detach":
      spawn(process.execPath, rest, { detached: true, stdio: "ignore" }).unref();
      return;
    default:
      console.error(USAGE);
      process.exit(2);
  }
}

const [command, ...rest] = argv;
try {
  await main(command, rest);
  process.exit(0);
} catch (error) {
  if (command === "run") console.log(JSON.stringify({ status: "error", detail: message(error) }, null, 2));
  else console.error(message(error));
  process.exit(1);
}
