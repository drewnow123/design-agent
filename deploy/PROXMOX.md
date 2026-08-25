# Running Handoff on Proxmox

Handoff is not a front end you can point at a backend. The page and the API are
one process that reads and writes the repository working tree, so the
repository has to live on the box you serve from. These steps put both there.

Target: an unprivileged Debian 12 LXC container. The server is a single Python
process with no dependencies, so a full VM buys overhead and nothing else.

## 1. Get the code somewhere the container can reach

**None of the console is committed yet.** A plain `git clone` on the VM would
give you a repository with no console in it. Commit and push first, or copy the
files across directly.

```
git add scripts/ work/agent-console/ work/agent-console-design/ deploy/ CLAUDE.md .gitignore .claude/launch.json
git commit -m "Add the Handoff console, its CLI, and deployment notes"
git push origin master
```

The only remote is `andrewhsv-site.git`. If you would rather not put the agent
tooling in that repository, skip the push and use the copy route in step 4.

## 2. Create the container

On the Proxmox host, fetch a Debian 12 template if you do not have one:

```
pveam update
pveam available --section system | grep debian-12
pveam download local debian-12-standard_12.12-1_amd64.tar.zst
```

The version suffix moves. Use whatever `available` actually printed.

```
pct create 120 local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst \
  --hostname handoff \
  --cores 2 --memory 1024 --swap 512 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.50/24,gw=192.168.1.1 \
  --unprivileged 1 \
  --onboot 1 \
  --password

pct start 120
pct enter 120
```

A static address is worth setting. You will be typing it into a phone, and it
ends up in a systemd unit.

| Resource | Console only | Console plus the pipeline |
|---|---|---|
| cores | 1 | 2 |
| memory | 512 MB | 2048 MB |
| disk | 4 GB | 16 GB, Node and npm are not small |

## 3. Install what it needs

```
apt update
apt install -y python3 git
python3 --version        # must be 3.8 or newer
```

Debian 12 ships Python 3.11. No pip install, no virtualenv, no requirements
file: the console and its CLI import nothing outside the standard library.

## 4. Put the repository at /srv/my-design-agent

```
adduser --system --group --home /srv/my-design-agent handoff
```

If you pushed in step 1:

```
git clone https://github.com/drewnow123/andrewhsv-site.git /srv/my-design-agent
chown -R handoff:handoff /srv/my-design-agent
```

If you would rather copy the files across, from the Proxmox host:

```
pct push 120 /path/to/my-design-agent.tar.gz /tmp/repo.tar.gz
pct exec 120 -- tar -xzf /tmp/repo.tar.gz -C /srv/
pct exec 120 -- chown -R handoff:handoff /srv/my-design-agent
```

Do not copy `.handoff/` across even if you have one locally. It is gitignored on
purpose. The box you serve from keeps its own live state, and two machines
writing one state file is the problem the locking design exists to prevent.

## 5. Create the state directory before the service starts

```
sudo -u handoff mkdir -p /srv/my-design-agent/.handoff
```

**Not optional.** The unit sets `ProtectSystem=strict` and names `.handoff` as
the only writable path. systemd refuses to start a service whose
`ReadWritePaths` does not exist, and the error talks about mount namespaces
rather than a missing directory.

## 6. Install the service

The unit ships at `deploy/handoff.service`. Set `ExecStart` to the hostnames you
intend to use, then:

```
cp /srv/my-design-agent/deploy/handoff.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now handoff
systemctl status handoff
journalctl -u handoff -f
```

**If it fails with status `226/NAMESPACE`** inside an unprivileged container,
that is sandboxing the container will not grant. Comment out these three lines,
reload, start again. You lose defence in depth, not function:

```
# ProtectSystem=strict
# PrivateDevices=yes
# MemoryDenyWriteExecute=yes
```

Keep `NoNewPrivileges`, `ProtectHome` and `RestrictAddressFamilies`.

## 7. Check it

```
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8790/api/state
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8790/
```

A fresh box has no state file, so `/api/state` answers 404 and the console shows
its empty state. That is correct. The page itself must answer 200.

Give it something to show:

```
cd /srv/my-design-agent
sudo -u handoff python3 scripts/handoff.py start hello-world design-strategist
sudo -u handoff python3 scripts/handoff.py show
```

Then open `http://192.168.1.50:8790` from your desktop.

## 8. Reaching it by name, and the header that will stop you

The server refuses any `Host` header it does not recognise, which is what stops
a name an attacker controls from resolving to your LAN address and talking to
this process from a page you visited. Out of the box it accepts `localhost` and
bare IP addresses only, so every reverse proxy fails too: a proxy rewrites
`Host` to its own name.

| How you reach it | Result |
|---|---|
| `http://192.168.1.50:8790` | works, no configuration |
| `http://localhost:8790` | works, on the box itself |
| `http://handoff.lan:8790` | 403 until named with `--allow-host` |
| behind nginx or Caddy | 403 until the proxy's hostname is named |

```
ExecStart=/usr/bin/python3 scripts/console.py --allow-host handoff.lan --allow-host handoff.example.com
```

The match is exact rather than a suffix, so allowing `handoff.lan` does not
admit `handoff.lan.somewhere-else.com`.

Behind a proxy with TLS, bind to loopback so the only route in is the proxy:

```
handoff.example.com {
    reverse_proxy 127.0.0.1:8790
}
```

```
ExecStart=/usr/bin/python3 scripts/console.py --host 127.0.0.1 --allow-host handoff.example.com
```

## 9. Answering asks from a phone

On the same network, nothing more is needed. Triage and question asks are built
to be cleared from a phone, and the build review deliberately refuses to embed a
desktop layout in a 375px viewport.

From outside, use a tailnet rather than forwarding a port. In an unprivileged
container Tailscale needs the TUN device passed in. On the **Proxmox host**, add
to `/etc/pve/lxc/120.conf`:

```
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Restart the container, then inside it:

```
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

Then allow the tailnet name like any other hostname:

```
ExecStart=/usr/bin/python3 scripts/console.py --allow-host handoff.your-tailnet.ts.net
```

## 10. Optional: run the pipeline on the same box

This is the arrangement the design assumes. The orchestrator records stage
transitions by writing the same state file the console serves, so one machine
means a local atomic rename and a lock file both processes can genuinely see.

```
apt install -y nodejs npm
node --version           # 18 or newer
npm install -g @anthropic-ai/claude-code
```

Run it as the account that owns the tree, or it creates files the service cannot
write:

```
sudo -u handoff -H bash
cd /srv/my-design-agent
claude
```

Authentication happens in the terminal and needs a browser once. After that the
board updates itself, because `CLAUDE.md` tells the orchestrator to call
`scripts/handoff.py` at every stage.

### The alternative, and what it costs

You can keep the repository on Windows and export it to the container over SMB
or NFS. It works, but `state.json` is replaced through a temp file and a rename,
and the write lock is an `O_EXCL` lock file. Both are guarantees a local
filesystem makes and a network filesystem weakens. The failure is rare and looks
like a decision going quietly missing. If you go this way, run the console on
the machine that owns the disk.

## When something is wrong

| Symptom | Cause and fix |
|---|---|
| 403 | The `Host` header is a name the server does not know. Add `--allow-host <name>`. Reaching it by IP always works and is the fastest way to confirm. |
| 404 on `/api/state` | No state file yet. Expected on a fresh box. Run `handoff.py start` once. |
| connection refused | Bound to loopback while connecting from elsewhere. Check `--host`, and the container firewall on 8790. |
| `226/NAMESPACE` | systemd hardening the container will not grant, or a missing `.handoff`. Create the directory, then comment out the three lines in step 6. |
| permission denied | Something ran as root and left files the service account cannot write. `chown -R handoff:handoff /srv/my-design-agent`. |
| stuck `state.lock` | A writer was killed mid-write. Locks older than 60 seconds break automatically; if one persists and nothing is running, delete `.handoff/state.lock`. |
| 500 on `/api/state` | `state.json` exists and will not parse. The body says why. |

## What this does not have

**No authentication and no TLS of its own.** There are no accounts because there
is exactly one operator. Anyone who can reach the port can approve a direction,
send a build back, and change your repository's state.

Fine on a trusted network segment. Not fine on the open internet. If you want it
reachable from outside, put it behind something that authenticates: a tailnet is
the least work and the least to get wrong. Do not forward port 8790.

Flags: `--port` (8790), `--host` (0.0.0.0), `--allow-host` (repeatable).
