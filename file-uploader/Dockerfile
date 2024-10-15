FROM node:21 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

COPY .env .env

RUN npm run build

FROM nginx:stable-alpine

COPY --from=build /usr/src/app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]