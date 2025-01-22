FROM --platform=linux/amd64 node:14.16.1 as base

WORKDIR /app

COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json
RUN npm install

COPY frontend ./

CMD /bin/bash
