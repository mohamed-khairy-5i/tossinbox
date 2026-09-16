# TossInbox — disposable email CLI + MCP server for AI agents
# Build:  docker build -t tossinbox .
# MCP:    docker run -i tossinbox                     (stdio server for AI agents)
# CLI:    docker run --rm -it tossinbox node dist/cli.js --help
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci --no-audit --no-fund \
 && npm run build \
 && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Default entry: MCP stdio server (what AI agents connect to)
ENTRYPOINT ["node", "dist/mcp.js"]
