# BlediGo 🏛️ — Municipal Services & Citizen Engagement Platform

BlediGo is a modern web application designed to connect citizens directly with their local municipalities. It enables citizens to report complaints (réclamations), request services, track municipal activities, and communicate directly with municipal agents. The platform features an AI-driven classification engine that automatically assesses complaint urgency to streamline administrative workflows.

This project was managed using the **Scrum Agile Methodology** and organized via Trello.

📌 **Trello Scrum Board:** [BlediGo Scrum Board](https://trello.com/b/mk0hr8qB/untitled)

---

## 🏗️ Project Architecture & Tech Stack

BlediGo is structured as a unified monorepo divided into three specialized layers:

```
bledigo-app/
├── bledigo-react/              # 🖥️ Frontend client (Vite + React)
├── bledigo-api/                # ⚙️ REST API gateway (Node.js + Express)
│   └── ai-service/             # 🧠 AI Urgency Predictor (Python + Flask)
└── Report/                     # 📂 Project Specifications & Academic Reports
```

### 🛠️ Technology Stack
* **Frontend:** React 18 (Vite, TailwindCSS, React Router, Recharts, SVG Map of Tunisia, Axios)
* **Backend API:** Node.js, Express, MongoDB (Mongoose), JWT Auth, Multer (file uploads), Nodemailer
* **AI Microservice:** Python 3, Flask, Scikit-learn (TF-IDF + Logistic Regression NLP classifier)
* **Project Management:** Scrum framework, Trello board tracking, Git version control

---

## 🚀 Key Features

* **Citizen Workspace:**
  * Interactive SVG Map of Tunisia for regional service navigation.
  * Submit complaints (reclamations) with image uploads, precise location tagging, and **AI-powered urgency estimation**.
  * Real-time notifications and an interactive chat dashboard to communicate with municipal agents.
  * Rate municipal services and generate QR codes for official service certificates.
* **Agent Dashboard:**
  * Manage assigned complaints, update progress status, and submit intervention reports.
  * Chat directly with citizens to request additional information.
* **Admin Control Center:**
  * Complete user management (citizen accounts, agent assignment, role toggling).
  * System workload metrics and real-time visualization of agent distribution.
  * Interactive service creation and QR code generation.

---

## 🏃‍♂️ Quick Start & Setup

### Prerequisites
* Node.js (>= 18.0.0)
* MongoDB (Local instance or MongoDB Atlas URI)
* Python 3.8+

---

### 1. Backend REST API Setup
1. Navigate to the backend directory:
   ```bash
   cd bledigo-api
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment:
   * Create a `.env` file based on `.env.example`:
     ```env
     PORT=3001
     MONGO_URI=your_mongodb_connection_uri
     JWT_SECRET=your_secure_random_jwt_secret
     AI_SERVICE_URL=http://localhost:5000/predict
     CORS_ORIGINS=http://localhost:5173
     ```
4. Start the server:
   ```bash
   npm run dev      # Runs with nodemon for live updates
   # Or for production:
   npm start
   ```

---

### 2. AI Urgency Classifier Service Setup
1. Navigate to the AI microservice directory:
   ```bash
   cd bledigo-api/ai-service
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Train the NLP classifier model:
   ```bash
   python train_sample.py
   ```
4. Run the Flask API:
   ```bash
   python app.py
   # Service starts at http://localhost:5000
   ```

---

### 3. Frontend Client Setup
1. Navigate to the React frontend directory:
   ```bash
   cd bledigo-react
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Configure your API base URL:
   * Create a `.env` file:
     ```env
     VITE_API_URL=http://localhost:3001/api
     VITE_AI_URL=http://localhost:5000
     ```
4. Launch the Vite dev server:
   ```bash
   npm run dev
   # App opens at http://localhost:5173
   ```

---

## 📊 Scrum Organization & Project Delivery

This project followed a strict **Scrum Framework** to manage the backlog, deliver working software incrementally, and adapt to changing requirements:

* **Product Backlog:** All user stories (Citizen, Agent, Admin requirements) were mapped out as tasks on our Trello board.
* **Sprint Planning & Retrospectives:** Tasks were categorized into Sprints, moving from *To Do* $\rightarrow$ *In Progress* $\rightarrow$ *Testing/Review* $\rightarrow$ *Done*.
* **Sprint Deliverables:**
  * **Sprint 1:** Core Authentication, Complaining Engine (Réclamations), SVG Interactive Map, and Backend AI integration.
  * **Sprint 2:** Municipal Service request pipeline (Demands), QR Code integrations, and Agent workload dashboards.
  * **Sprint 3:** Chat System (Citizen $\leftrightarrow$ Agent), Notifications engine, Admin control panel, and final QA testing.
* **Documentation & Conception:** Visual UML diagrams (Class, Use Case, Sequence diagrams) and requirements analyses are compiled inside the root [Report/](file:///c:/Users/oussa/OneDrive/Bureau/bledigo%20App/Report) folder.
