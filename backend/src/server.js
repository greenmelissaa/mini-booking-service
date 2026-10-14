const { openDb } = require('./db');
const { createApp } = require('./app');
const { DB_FILE, PORT } = require('./config');

const db = openDb(DB_FILE);
const app = createApp({ db });
app.listen(PORT, () => console.log(`API jalan di http://localhost:${PORT}`));