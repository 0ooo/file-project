FROM node:21

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

COPY .env .env

RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]