---
name: homelab
description: Look up or update which host runs a self-hosted service, on which port, and where it is defined, across the user's tailnet (moss, redwood, mycelium, colton-router). Use when a task touches a self-hosted service, a port or URL on those hosts, or the tailnet's devices, and whenever a task adds, moves, or removes a permanent service.
---

# Homelab inventory

The private repository `265866/homelab` is the source of truth for every permanent service, port, and host in the tailnet. Its dashboard is linked from the repository's README.

## Look something up

Read the inventory instead of scanning hosts:

```sh
gh api repos/265866/homelab/contents/inventory/services.yaml --jq .content | base64 -d
gh api repos/265866/homelab/contents/inventory/hosts.yaml --jq .content | base64 -d
```

On moss, read the clone at `~/src/homelab` instead. Each service records its host, ports, URL, purpose, and `source`, which says where to change it. Treat the inventory as a starting point and confirm on the host before you act on a port or container name.

## Keep it current

When a task adds, moves, or removes a permanent service on any of these hosts, update the inventory in the same task. Follow the repository's CLAUDE.md, which covers the fields, the `bun run check` drift check, and deployment. Dev servers and short experiments stay out of the inventory.
