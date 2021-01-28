const Metro = require('../../packages/metro')

const express = require('express');
const app = express();
const server = require('http').Server(app);

Metro.loadConfig().then(async config => {
  await Metro.runServer(config, {
    port: 8081,
  });
  const connectMiddleware = await Metro.createConnectMiddleware(config);
  const {server: {port}} = config;
  app.use(connectMiddleware.middleware);
  server.listen(8081);
  connectMiddleware.attachHmrServer(server);
});