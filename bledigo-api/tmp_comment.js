const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/bledigo', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('reclamations').find({}).toArray();
    if (!items.length) return console.log('No reclamations');
    
    // add comment to the latest reclamation
    await db.collection('reclamations').updateOne(
      { _id: items[items.length - 1]._id },
      { $push: { comments: { _id: new mongoose.Types.ObjectId(), text: 'Ceci est un test de modération !', authorName: 'Système Administrateur', createdAt: new Date() } } }
    );
    console.log('Test comment added to ID:', items[items.length - 1]._id);
  })
  .catch(console.error)
  .finally(() => mongoose.disconnect());
