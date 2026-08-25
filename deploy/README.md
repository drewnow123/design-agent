# Running Handoff on a server

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
