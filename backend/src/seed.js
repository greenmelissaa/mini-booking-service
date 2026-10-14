const bcrypt = require('bcryptjs');
const { openDb } = require('./db');
const { DB_FILE } = require('./config');

function seed(db) {
    const hash = bcrypt.hashSync('password123', 8);
    const insUser = db.prepare('INSERT OR IGNORE INTO users (username,password_hash,name) VALUES (?,?,?)');
    insUser.run('budi', hash, 'Budi'); insUser.run('sari', hash, 'Sari');
    for (let i = 1; i <= 50; i++) insUser.run(`load${i}`, hash, `Load ${i}`);

    if (db.prepare('SELECT COUNT(*) c FROM schedules').get().c > 0) return;
    const op = db.prepare('INSERT INTO operators (name) VALUES (?)');
    const ops = [op.run('Primajasa').lastInsertRowid, op.run('XTrans').lastInsertRowid];
    const rt = db.prepare('INSERT INTO routes (origin,destination) VALUES (?,?)');
    const routes = [['Bandung','Jakarta'],['Jakarta','Bandung'],['Bandung','Bogor']]
        .map(r => rt.run(...r).lastInsertRowid);
    const sc = db.prepare('INSERT INTO schedules (route_id,operator_id,departure_time,arrival_time,price) VALUES (?,?,?,?,?)');
    const st = db.prepare('INSERT INTO seats (schedule_id,seat_number) VALUES (?,?)');

    db.transaction(() => {
        for (let d = 0; d < 7; d++) for (const r of routes) for (const h of [7, 13, 19]) {
    const dep = new Date(); dep.setDate(dep.getDate() + d); dep.setHours(h, 0, 0, 0);
    const arr = new Date(dep.getTime() + 3 * 3600e3);
    const sid = sc.run(r, ops[h % 2], dep.toISOString(), arr.toISOString(), 120000).lastInsertRowid;
        for (let row = 1; row <= 5; row++) for (const c of 'ABCD') st.run(sid, `${row}${c}`);
        }
    })();
}
module.exports = { seed };
if (require.main === module) { seed(openDb(DB_FILE)); console.log('Seed selesai'); }

