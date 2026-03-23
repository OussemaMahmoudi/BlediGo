/**
 * Run this ONCE with:  node hash.js
 * It prints the bcrypt hash of "admin"
 * then you paste it directly in MongoDB Compass
 */
const bcrypt = require('bcryptjs');

async function main() {
  const hash = await bcrypt.hash('admin', 12);
  console.log('\n✅  Copie cette valeur dans MongoDB Compass :\n');
  console.log(hash);
  console.log('\n');
}

main();
