# Runtime security baseline

Production server and bot images use Node 24.22.1, which includes the October 21,
2026 Node.js security fixes, including CVE-2026-111497 in Brotli decoding.
Both images run `scripts/check-node-security.cjs` during their build to reject
older affected or unsupported runtime versions. Keep the pinned version current;
the check enforces this security baseline, not the absence of future vulnerabilities.

Rebuild both images when changing the runtime. Updating a host's Node.js package
does not update the runtime inside an existing container. Preserve the deployment
environment and database backup before replacing production containers.

```sh
node --test scripts/check-node-security.test.cjs
docker compose build --pull synapse-game synapse-bot
docker compose up -d --no-deps synapse-game synapse-bot cloudflare-tunnel
docker exec synapse-game node --version
docker exec synapse-bot node --version
```

The client ID is a public client build argument. Discord secrets and environment
files must stay outside the image build context. Secrets are supplied at runtime.

The Cloudflare tunnel image is pinned separately in `docker-compose.yml`.
