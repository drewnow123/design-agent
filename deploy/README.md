# Running Handoff on a server

> **The live arrangement is Windows, not a server.** The pipeline and the
> console both run on the workstation now, and `console-windows.ps1` is what
> keeps the console up. See "Running it on Windows" at the bottom. Everything
> above that section describes the Linux server option, which still works and
> was in use until 2026-08-26, but is not what is currently deployed.

## The thing to understand first

Handoff is not a front end you can host somewhere and point at a backend. The
page and the API are one process, and that process reads and writes the
repository working tree directly: `.handoff/state.json`, `.handoff/responses/`,
and the built sites under `work/` that the build asks link to.

So "run it on the Proxmox box" means **the repository lives on the Proxmox
box**. There are two honest ways to arrange that.

### Option 1: run the pipeline there too

Repository, Claude Code, and the console all on the VM. You SSH in to run the
pipeline, and the console is reachable from any browser on the network. Nothing
is shared, nothing can disagree, and `os.replace` is a local atomic rename the
way it was designed to be.

This is the arrangement to pick.

### Option 2: share the filesystem

Repository on your workstation, exported to the VM over NFS or SMB, console
running on the VM.

It works, but know what you are giving up. `state.json` is replaced atomically
through a temp file and a rename, and the write lock is an `O_EXCL` lock file.
Both of those are guarantees the local filesystem makes and a network
filesystem weakens: SMB in particular can reorder and cache metadata in ways
that make a rename non atomic from the other side. The failure is rare and it
looks like a lost decision, which is the worst kind of rare.

If you take this option, run the console on the machine that owns the disk and
mount the other way round.

## Install

```
sudo adduser --system --group --home /srv/my-design-agent handoff
sudo git clone <your remote> /srv/my-design-agent
sudo chown -R handoff:handoff /srv/my-design-agent
sudo cp deploy/handoff.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now handoff
```

Python 3.8 or newer. No pip install, no virtualenv, no packages: the console
and its CLI import nothing outside the standard library.

Check it: `systemctl status handoff`, then `journalctl -u handoff -f`.

## The Host header will bite you

The server refuses any `Host` it does not recognise, which is what stops a
hostname an attacker controls from resolving to your LAN address and talking to
this process from a page you visited. Out of the box it accepts `localhost` and
bare IP addresses only.

That means:

| How you reach it | Works? |
|---|---|
| `http://192.168.1.50:8790` | yes |
| `http://localhost:8790` on the box | yes |
| `http://handoff.lan:8790` | **403 until you allow it** |
| Anything behind nginx, Caddy, or Traefik | **403 until you allow it**, because a proxy rewrites `Host` to its own name |

Name every hostname you intend to use:

```
ExecStart=/usr/bin/python3 scripts/console.py --allow-host handoff.lan --allow-host handoff.example.com
```

The match is exact, not a suffix, so allowing `handoff.lan` does not admit
`handoff.lan.somewhere-else.com`.

## Behind a reverse proxy

Terminate TLS at the proxy and pass through. Caddy:

```
handoff.example.com {
    reverse_proxy 127.0.0.1:8790
}
```

Then bind the console to loopback so the only way in is through the proxy, and
allow the proxy's hostname:

```
ExecStart=/usr/bin/python3 scripts/console.py --host 127.0.0.1 --allow-host handoff.example.com
```

## What this does not have

**No authentication and no TLS of its own.** Anyone who can reach the port can
approve a direction, send a build back, and change your repository's state.
There are no accounts because there is exactly one operator.

That is fine on a trusted LAN segment. It is not fine on the open internet. If
you want it reachable from outside the house, put it behind something that
authenticates: a VPN or Tailscale is the least work and the least to get wrong,
an authenticating reverse proxy is the alternative. Do not port forward 8790.

## Flags

| Flag | Default | What it does |
|---|---|---|
| `--port` | `8790` | Port to bind. |
| `--host` | `0.0.0.0` | Address to bind. `127.0.0.1` refuses everything but the box itself, which is what you want behind a proxy. |
| `--allow-host` | none | A hostname the `Host` header may carry, on top of `localhost` and IP literals. Repeatable. |

## Running it on Windows

The console has to outlive whatever started it. Started from a Claude Code
session it is a child of that session, so closing the session takes the board
down, and the phone that was going to clear an ask finds nothing listening.

```
powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Install -Start
powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Status
powershell -ExecutionPolicy Bypass -File deploy\console-windows.ps1 -Stop -Uninstall
```

`-Install` writes one file, `handoff-console.vbs`, into your own Startup
folder. `-Start` launches the console now, detached, so it survives the shell
that started it. `-Status` prints what is running, whether the logon entry
exists, where the log is, and both URLs.

**Deliberately not a scheduled task or a service.** Those are machine settings
that need elevation. This is one file in your profile that you can read and
delete without administrator rights, and the trade is that the console starts
at logon rather than at boot. For a board you answer from a phone while the
machine is in use, logon is the honest trigger.

A `.vbs` rather than a `.cmd` or a shortcut, because a `.cmd` in Startup shows
a console window for as long as the server runs, and a `.lnk` cannot carry the
output redirect. `WScript.Shell.Run` with a window style of `0` and `wait =
False` is the one combination that starts hidden without blocking logon.

Output goes to `.handoff\console.log`, which is where a startup failure shows
up. It is `python` rather than `pythonw` for exactly that reason: `pythonw`
discards stdout, and a server that fails silently at logon is worse than one
that does not start.

### The firewall will bite you before the Host header does

The console binds `0.0.0.0`, but Windows Firewall blocks inbound connections to
it until told otherwise, so **the LAN URL does not work out of the box** even
though the server is listening and `127.0.0.1` is fine. `-Status` says whether
a rule exists. To add one, in an administrator PowerShell:

```
New-NetFirewallRule -DisplayName 'Handoff console' `
  -Direction Inbound -Protocol TCP -LocalPort 8790 `
  -Profile Private -Action Allow
```

`-Profile Private` on purpose. If your network is classified Public, either
reclassify it or the rule will not apply, and reclassifying is the safer of the
two because a Public profile is doing other work you want.

### The preview server is separate, and does not survive

Build asks embed a preview from `static-preview` on port 8788, which this
script does not manage. Start it from the `static-preview` launch config, or
`python scripts\preview.py`. If it is down, a build ask still renders and its
locator still resolves, but the embedded frame is empty.
