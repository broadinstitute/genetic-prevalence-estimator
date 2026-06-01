FROM node:24.16 as base

WORKDIR /app

RUN npm install -g pnpm@11.5

COPY frontend/package.json ./package.json
COPY frontend/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY frontend/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

COPY frontend ./

CMD ["pnpm", "start"]
