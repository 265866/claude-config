# Runs inside the agent-chrome Windows VM. agent-chrome.ts on redwood copies it to C:\agent-chrome and calls it
# over SSH: agent.ps1 <launch|running|owns-port|kill> <profile> [debugging port; launch without one opens a sign-in window]
param([Parameter(Mandatory)][string]$Command, [Parameter(Mandatory)][string]$ProfileName, [int]$Port = 0)
$ErrorActionPreference = 'Stop'
if ($ProfileName -cnotmatch '^[a-z0-9][a-z0-9-]{0,31}$') { throw "Bad profile name $ProfileName" }

$root = 'C:\agent-chrome'
$dir = Join-Path $root "profiles\$ProfileName"
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileArgument = '--user-data-dir=' + [regex]::Escape($dir) + '("|\s|$)'

# The browser process is chrome.exe with this profile; its helper processes carry --type=.
function Get-BrowserProcess {
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
        Where-Object { $_.CommandLine -match $profileArgument -and $_.CommandLine -notmatch '--type=' }
}

switch ($Command) {
    'launch' {
        # The VM's traffic leaves through redwood's sockets. HTTPS goes through redwood's proxy, which
        # sends it with the TTL Windows uses; the proxy carries only CONNECT, so plain HTTP goes direct.
        $arguments = @("--user-data-dir=$dir", '--no-first-run', '--no-default-browser-check', '--start-maximized',
            '--proxy-server=https=http://169.254.1.3:18090')
        if ($Port -gt 0) {
            # Same flags as agent-chrome.ts uses for a local Chrome; see the comments there.
            $arguments += "--remote-debugging-port=$Port", '--disable-blink-features=AutomationControlled',
                '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
                '--disable-background-timer-throttling', 'about:blank'
        }
        $line = '@start "" "' + $chrome + '" ' + (($arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ')
        Set-Content -Path "$root\launch-$ProfileName.cmd" -Value $line -Encoding ascii
        # An SSH session has no desktop. A task that runs only when the user is logged on opens Chrome on
        # the signed-in desktop, which the web viewer shows and where pages see a normal screen.
        if (-not (Get-CimInstance Win32_Process -Filter "Name='explorer.exe'")) {
            throw 'Nobody is logged on to the VM desktop, so Chrome has nowhere to open. Restart the VM; it logs on automatically.'
        }
        # Through cmd, because schtasks warns on stderr that the start time has passed, and PowerShell 5.1
        # turns any native stderr into an error under ErrorActionPreference Stop.
        $output = cmd /c "schtasks /create /tn agent-chrome-$ProfileName /tr $root\launch-$ProfileName.cmd /sc once /st 00:00 /it /ru agent /f 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "schtasks /create failed: $output" }
        $output = cmd /c "schtasks /run /tn agent-chrome-$ProfileName 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "schtasks /run failed: $output" }
    }
    'running' { if (Get-BrowserProcess) { 'yes' } else { 'no' } }
    # Proves the debugging listener on $Port belongs to this profile's browser, not another Chrome.
    'owns-port' {
        $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        $browser = Get-BrowserProcess | Select-Object -ExpandProperty ProcessId
        if ($owners | Where-Object { $browser -contains $_ }) { 'yes' } else { 'no' }
    }
    'kill' { Get-BrowserProcess | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } }
    default { throw "Unknown command $Command" }
}
