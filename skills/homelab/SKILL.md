---
name: homelab
description: Look up or update which host runs a self-hosted service, on which port, and where it is defined, across the user's tailnet (redwood, moss, mycelium, sms-inbox, colton-router). Use when a task touches a self-hosted service, a port or URL on those hosts, the tailnet's devices, or its access policy, and whenever a task adds, moves, or removes a permanent service.
---

# Homelab inventory

The private repository `265866/homelab` is the source of truth for every permanent service, port, and host in the tailnet, and for the tailnet's access policy in `tailnet/policy.hujson`. Its dashboard is linked from the repository's README.

## Look something up

Read the inventory instead of scanning hosts:

```sh
gh api repos/265866/homelab/contents/inventory/services.yaml --jq .content | base64 -d
gh api repos/265866/homelab/contents/inventory/hosts.yaml --jq .content | base64 -d
```

On redwood, read the clone at `~/src/homelab` instead. Each service records its host, ports, URL, purpose, and `source`, which says where to change it. Treat the inventory as a starting point and confirm on the host before you act on a port or container name.

## Keep it current

When a task adds, moves, or removes a permanent service on any of these hosts, update the inventory in the same task. Dev servers and short experiments stay out of the inventory.

Every change to `inventory/` or `tailnet/policy.hujson` goes through a pull request on `265866/homelab`, from a branch in your own clone. Never push to `main`, and never commit in redwood's clone at `~/src/homelab`: redwood deploys `main` within five minutes of a merge, and refuses to deploy a clone with local commits. Opening and merging the pull request follow your usual approval rules. Before you open it, run `homelab validate` and, on redwood, `homelab check`, as the repository's AGENTS.md describes; AGENTS.md also covers the fields, the checks that define "up", and deployment.
