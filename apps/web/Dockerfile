FROM node:22-alpine AS build

WORKDIR /app

# Copia os manifestos de dependências
COPY package.json package-lock.json ./

# Instala todas as dependências
RUN npm install

# Copia o código-fonte da aplicação
COPY . .

RUN npm run build \
    && test -f /app/build/index.html


FROM nginx:stable-alpine

COPY default.conf /etc/nginx/conf.d/default.conf
COPY env.js.template /etc/nginx/templates/env.js.template
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/build/. /usr/share/nginx/html/
RUN test -f /usr/share/nginx/html/index.html \
    && nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
