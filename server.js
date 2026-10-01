const app = require('./app');
const config = require('./config/config');

app.listen(config.port, () => {
  console.log(`ShopEase server running at http://localhost:${config.port}`);
  console.log(`Admin login: ${config.adminEmail} (run "npm run seed" if you haven't already)`);
});
