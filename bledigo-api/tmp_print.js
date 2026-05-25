const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/bledigo')
  .then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('reclamations').find({'comments.0': {$exists: true}}).toArray();
    console.log(JSON.stringify(items.map(r => r.comments), null, 2));
  })
  .finally(() => process.exit(0));
