<#
.SYNOPSIS
    Keep the Handoff console running on Windows, across session and machine restarts.

.DESCRIPTION
    The console has to outlive whatever started it. Run from a Claude Code
    session it is a child of that session, so closing the session takes the
    board down with it, and the phone that was going to clear an ask finds
    nothing listening.

    This registers it as a per-user startup entry instead. Deliberately NOT a
    scheduled task or a service: those are machine settings that need
    elevation, and this needs neither. It is one file in your own profile,
    which you can read, and delete, without administrator rights.

    The console binds 0.0.0.0 so a phone on the LAN can reach it. Windows
    Firewall will not allow that until you say so, once. See -Status output.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Install -Start
    powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Status
    powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Stop -Uninstall
#>

[CmdletBinding()]
param(
    [switch]$Install,     # run the console at every logon
    [switch]$Uninstall,   # stop running it at logon
    [switch]$Start,       # start it now, detached from this shell
    [switch]$Stop,        # stop whatever is on the port
    [switch]$Status,      # what is running, and where the log is
    [int]$Port = 8790
)

$ErrorActionPreference = 'Stop'

$Repo    = Split-Path -Parent $PSScriptRoot
$Script  = Join-Path $Repo 'scripts\console.py'
$LogDir  = Join-Path $Repo '.handoff'
$Log     = Join-Path $LogDir 'console.log'
$Startup = [Environment]::GetFolderPath('Startup')
$Entry   = Join-Path $Startup 'handoff-console.vbs'

if (-not (Test-Path $Script)) {
    throw "no $Script - run this from the repository's deploy directory"
}

function Get-Listener {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $c) { return $null }
    Get-Process -Id ($c | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
}

function Start-Console {
    if (Get-Listener) {
        Write-Host "  already listening on $Port, leaving it alone"
        return
    }
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

    # cmd does the redirect so the log survives, and the window is hidden so
    # nothing flashes up at logon. python rather than pythonw, because pythonw
    # discards stdout and the log is the only place a startup failure would
    # otherwise be visible.
    $cmd = "cmd /c `"cd /d `"`"$Repo`"`" && python scripts\console.py --port $Port >> `"`"$Log`"`" 2>&1`""
    $sh = New-Object -ComObject WScript.Shell
    $sh.Run($cmd, 0, $false) | Out-Null

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 250
        if (Get-Listener) { break }
    }
    $p = Get-Listener
    if ($p) { Write-Host "  started, PID $($p.Id)" }
    else { Write-Host "  did not come up. Check $Log" }
}

if ($Stop) {
    $p = Get-Listener
    if ($p) { Stop-Process -Id $p.Id -Force; Write-Host "  stopped PID $($p.Id)" }
    else { Write-Host "  nothing listening on $Port" }
}

if ($Uninstall) {
    if (Test-Path $Entry) { Remove-Item $Entry -Force; Write-Host "  removed $Entry" }
    else { Write-Host "  no startup entry to remove" }
}

if ($Install) {
    # A .vbs rather than a .cmd or a shortcut. A .cmd in Startup shows a
    # console window for as long as the server runs, and a .lnk cannot carry
    # the redirect. WScript.Shell.Run with a window style of 0 and wait=false
    # is the one combination that starts hidden and does not block logon.
    $vbs = @"
' Starts the Handoff console at logon. Written by deploy\console-windows.ps1.
' Delete this file, or run that script with -Uninstall, to stop it.
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c cd /d ""$Repo"" && python scripts\console.py --port $Port >> "".handoff\console.log"" 2>&1", 0, False
"@
    Set-Content -Path $Entry -Value $vbs -Encoding ASCII
    Write-Host "  installed $Entry"
}

if ($Start) { Start-Console }

if ($Status -or -not ($Install -or $Uninstall -or $Start -or $Stop)) {
    Write-Host ""
    Write-Host "  repository   $Repo"
    $p = Get-Listener
    if ($p) { Write-Host "  console      running, PID $($p.Id), port $Port" }
    else     { Write-Host "  console      not running" }
    if (Test-Path $Entry) { Write-Host "  at logon     yes, $Entry" }
    else                  { Write-Host "  at logon     no. Run with -Install" }
    if (Test-Path $Log)   { Write-Host "  log          $Log" }

    $rule = Get-NetFirewallRule -DisplayName 'Handoff console' -ErrorAction SilentlyContinue
    if ($rule) {
        Write-Host "  firewall     a 'Handoff console' rule exists"
    } else {
        Write-Host "  firewall     no rule. A phone on the LAN cannot reach this yet."
        Write-Host "               To allow it, in an ADMIN PowerShell:"
        Write-Host "               New-NetFirewallRule -DisplayName 'Handoff console' ``"
        Write-Host "                 -Direction Inbound -Protocol TCP -LocalPort $Port ``"
        Write-Host "                 -Profile Private -Action Allow"
    }
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
           Select-Object -First 1).IPAddress
    Write-Host ""
    Write-Host "  here         http://127.0.0.1:$Port"
    if ($ip) { Write-Host "  phone        http://${ip}:$Port" }
    Write-Host ""
}
