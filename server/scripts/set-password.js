require('dotenv').config();
const bcrypt = require('bcryptjs');
const { init, db } = require('../db');

const [username = 'admin', password] = process.argv.slice(2);

if (!password) {
  console.error('Uso: node scripts/set-password.js <usuario> <nova_senha>');
  process.exit(1);
}

init()
  .then(() => {
    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`);
      process.exit(1);
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(password, 10),
      user.id
    );
    console.log(`Senha do usuário "${username}" atualizada com sucesso.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro ao atualizar a senha:', err);
    process.exit(1);
  });
