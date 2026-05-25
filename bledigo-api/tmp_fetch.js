const axios = require('axios');
const jwt = require('jsonwebtoken');

// Create admin token
const token = jwt.sign({ id: 'some-admin-id', role: 'Admin' }, process.env.JWT_SECRET || 'bledigo_jwt_super_secret_key_2026_do_not_share', { expiresIn: '1h' });

axios.get('http://localhost:3001/api/reclamations/all?limit=5', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => {
  console.log(JSON.stringify(r.data.data.reclamations[0].comments, null, 2));
}).catch(console.error);
