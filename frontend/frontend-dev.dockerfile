FROM node:14.16.1 as base

WORKDIR /app

COPY frontend/package.json ./package.json
RUN npm install

COPY frontend ./

CMD ["npm", "start"]
