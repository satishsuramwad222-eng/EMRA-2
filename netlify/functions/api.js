// // Netlify Function that runs the existing Express app (app.js) unchanged.
// // /api/* and /uploads/* are routed here by netlify.toml.
// const serverless = require('serverless-http');
// const { connectLambda } = require('@netlify/blobs');
// const app = require('../../app');

// const handle = serverless(app, {
//   binary: ['application/pdf', 'image/*', 'application/octet-stream'],
// });

// exports.handler = async (event, context) => {
//   connectLambda(event); // gives @netlify/blobs its credentials
//   // Make sure Express sees the original public path (/api/..., /uploads/...)
//   const prefix = '/.netlify/functions/api';
//   if (event.path && event.path.startsWith(prefix)) {
//     event.path = event.path.slice(prefix.length) || '/';
//   }
//   return handle(event, context);
// };
const serverless = require("serverless-http");
const app = require("../../app");

module.exports.handler = serverless(app);