// Usage: node server/create-admin.js <email> <name> [password-file]
const path = require('path'); const fs = require('fs');
const Database = require('better-sqlite3');
const auth = require('./auth');
const [email, name, file] = process.argv.slice(2);
if (!email || !name) { console.error('Usage: node server/create-admin.js <email> <name> [password-file]'); process.exit(1); }
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = new Database(path.join(DATA_DIR, 'mondo.db'));
const A = auth.setup(db);
const pw = process.env.ADMIN_PASSWORD || auth.easyPassword();
const exists = db.prepare('select * from users where email=?').get(email.toLowerCase());
if (exists) { db.prepare('update users set pass_hash=?, role=? where id=?').run(require('bcryptjs').hashSync(pw, 12), 'admin', exists.id); db.prepare('delete from sessions where user_id=?').run(exists.id); }
else {
  const person = db.prepare("select id from people where id='p_simon'").get() && /simon/i.test(name) ? 'p_simon' : undefined;
  A.createUser({ email, name, password: pw, role: 'admin', person_id: person });
}
if (file) { fs.writeFileSync(file, `mondo admin login\nemail: ${email}\npassword: ${pw}\n`, { mode: 0o600 }); fs.chmodSync(file, 0o600); console.log('Password written to', file); }
else console.log('Password:', pw);
