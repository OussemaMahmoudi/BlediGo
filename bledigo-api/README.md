# BlediGo API 🏛

> REST API for the BlediGo Municipal Services Platform  
> **Stack:** Node.js · Express · MongoDB · JWT · Python AI Microservice

---

## Architecture

```
bledigo-api/
├── server.js                   ← Express entry point
├── .env.example                ← Environment variables template
├── config/
│   └── db.js                   ← MongoDB connection with retry
├── models/
│   ├── User.js                 ← Users (Citoyen / Agent / Admin)
│   ├── Reclamation.js          ← Reclamations with AI urgency field
│   ├── Service.js              ← Municipal services + QR codes
│   └── Notification.js         ← User notifications
├── controllers/
│   ├── authController.js       ← Register, Login, Me
│   ├── reclamationController.js ← CRUD + AI call + voting
│   ├── serviceController.js    ← Services + demands + ratings
│   ├── userController.js       ← User management
│   └── notificationController.js
├── routes/
│   ├── auth.js
│   ├── reclamations.js
│   ├── services.js
│   ├── users.js
│   ├── agents.js
│   └── notifications.js
├── middleware/
│   ├── auth.js                 ← JWT protect + authorize(role)
│   ├── errorHandler.js         ← Global error normalizer
│   └── upload.js               ← Multer file uploads
├── utils/
│   ├── aiClient.js             ← Python AI microservice client ★
│   └── jwt.js                  ← Token helpers
└── ai-service/
    ├── app.py                  ← Flask AI microservice
    ├── requirements.txt
    └── train_sample.py         ← Seed training script
```

---

## Quick Start

### 1. Install dependencies
```bash
cd bledigo-api
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Start MongoDB
```bash
# Local
mongod --dbpath ./data/db

# Or use MongoDB Atlas (set MONGO_URI in .env)
```

### 4. Start the Node.js API
```bash
npm run dev        # development (nodemon)
npm start          # production
```

### 5. Start the Python AI microservice
```bash
cd ai-service
pip install -r requirements.txt

# Optional: train the model first
python train_sample.py

# Then start the service
python app.py
# → Listening on http://localhost:5000
```

---

## AI Integration Flow ★

```
React Frontend
     │
     │  POST /api/reclamations
     │  { title, description, category, ... }
     ▼
Node.js API (reclamationController.js)
     │
     │  POST http://localhost:5000/predict
     │  { description, category }
     ▼
Python Flask Microservice (app.py)
     │
     │  ML model (TF-IDF + LogisticRegression)
     │  or keyword heuristics (fallback)
     │
     │  { urgency_level: "High", confidence: 0.87, reason: "..." }
     ▼
Node.js saves to MongoDB:
     reclamation.urgency = {
       level: "High",
       confidence: 0.87,
       reason: "...",
       aiGenerated: true
     }
     │
     ▼
201 Created → React Frontend
```

**Fallback behaviour:** If Python microservice is offline, `aiClient.js` catches
the `ECONNREFUSED` error, logs a warning, and defaults to `{ level: "Medium", confidence: 0, aiGenerated: false }`.
The citizen's reclamation is still saved — no data is lost.

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ✗ | Register new citizen |
| POST | `/api/auth/login` | ✗ | Login → get JWT |
| GET | `/api/auth/me` | ✓ | Current user profile |
| POST | `/api/auth/change-password` | ✓ | Change password |

### Reclamations
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/reclamations` | ✓ | Citoyen | Submit reclamation + **AI urgency** |
| GET | `/api/reclamations/my-history` | ✓ | Citoyen | My reclamations |
| GET | `/api/reclamations/all` | ✓ | Admin, Agent | All reclamations |
| GET | `/api/reclamations/public` | ✗ | — | Public feed |
| GET | `/api/reclamations/:id` | ✓ | Any | Single reclamation |
| PATCH | `/api/reclamations/:id/status` | ✓ | Admin, Agent | Update status |
| PATCH | `/api/reclamations/:id/assign` | ✓ | Admin | Assign to agent |
| POST | `/api/reclamations/:id/vote` | ✓ | Any | Vote/unvote |
| POST | `/api/reclamations/:id/comments` | ✓ | Any | Add comment |
| DELETE | `/api/reclamations/:id` | ✓ | Admin | Delete |

### Services
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/services` | ✗ | — | List services |
| GET | `/api/services/:id` | ✗ | — | Service detail |
| POST | `/api/services` | ✓ | Admin | Create service |
| PATCH | `/api/services/:id` | ✓ | Admin | Update service |
| DELETE | `/api/services/:id` | ✓ | Admin | Delete service |
| POST | `/api/services/:id/demand` | ✓ | Citoyen | Submit demand |
| PATCH | `/api/services/:id/demand/:demandId` | ✓ | Admin, Agent | Accept/reject |
| POST | `/api/services/:id/rate` | ✓ | Citoyen | Rate service |

### Users
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/users` | ✓ | Admin | List all users |
| GET | `/api/users/stats` | ✓ | Admin | User statistics |
| GET | `/api/users/:id` | ✓ | Admin / self | User profile |
| PATCH | `/api/users/:id` | ✓ | Admin / self | Update user |
| PATCH | `/api/users/:id/toggle-active` | ✓ | Admin | Activate / deactivate |
| DELETE | `/api/users/:id` | ✓ | Admin | Delete user |

### Agents
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/agents` | ✓ | Admin | List all agents |
| GET | `/api/agents/workload` | ✓ | Admin | Workload per agent |
| GET | `/api/agents/my-dashboard` | ✓ | Agent | Agent dashboard |
| POST | `/api/agents/report` | ✓ | Agent | Submit report |

### Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | ✓ | My notifications |
| PATCH | `/api/notifications/read-all` | ✓ | Mark all read |
| PATCH | `/api/notifications/:id/read` | ✓ | Mark one read |

### AI Microservice
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `http://localhost:5000/health` | Health check |
| POST | `http://localhost:5000/predict` | Classify urgency |
| POST | `http://localhost:5000/train` | Retrain model |

---

## Sample Requests

### Register
```json
POST /api/auth/register
{
  "firstName": "Ahmed",
  "lastName": "Mansour",
  "email": "ahmed@example.com",
  "password": "SecurePass123",
  "cin": "12345678",
  "municipality": "Tunis"
}
```

### Submit Reclamation (with AI urgency)
```
POST /api/reclamations
Authorization: Bearer <token>
Content-Type: multipart/form-data

title=Éclairage en panne Rue Ibn Khaldoun
description=Plusieurs lampadaires en panne depuis 5 jours. Zone très sombre la nuit, danger pour les piétons.
category=Eclairage public
location[address]=Rue Ibn Khaldoun
```
**Response:**
```json
{
  "success": true,
  "message": "Réclamation soumise avec succès.",
  "data": {
    "title": "Éclairage en panne Rue Ibn Khaldoun",
    "status": "Pending",
    "urgency": {
      "level": "High",
      "confidence": 0.84,
      "reason": "Indicateurs de risque élevé détectés...",
      "aiGenerated": true
    }
  }
}
```

### Update Status (Agent)
```json
PATCH /api/reclamations/65f1a2b3c4d5e6f7a8b9c0d1/status
Authorization: Bearer <agent-token>
{
  "status": "Resolved",
  "report": "Réparation effectuée le 18 mars. Remplacement de 3 lampadaires."
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `MONGO_URI` | `mongodb://localhost:27017/bledigo` | MongoDB connection string |
| `JWT_SECRET` | — | **Required.** Random string ≥ 32 chars |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `AI_SERVICE_URL` | `http://localhost:5000/predict` | Python AI endpoint |
| `AI_TIMEOUT_MS` | `4000` | AI call timeout |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `MAX_FILE_SIZE_MB` | `5` | Upload size limit |

---

## Health Check
```
GET /health
→ { "success": true, "message": "BlediGo API is running", ... }
```
