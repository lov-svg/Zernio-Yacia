FROM node:20-slim AS build

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm install --legacy-peer-deps; fi

COPY . .

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
