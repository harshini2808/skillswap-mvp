# SkillSwap MVP

A time-boxed full-stack MVP based on the SkillSwap project PPT: student registration/login, teach/learn skills, rule-based matching, exchange requests, sessions, credits, and reviews.

## Stack
- React + Vite frontend
- Node.js + Express API
- MySQL database
- JWT authentication + bcrypt password hashing

## Requirements
Node.js 18+ and MySQL 8+.

## 1. Create the database
Run `server/schema.sql` in MySQL. It creates the `skillswap` database and tables.

## 2. Start the API
```bash
cd server
cp .env.example .env
# Edit .env with your MySQL credentials and a long JWT_SECRET
npm install
npm run dev
```
API runs on http://localhost:5000.

## 3. Start the frontend
In a second terminal:
```bash
cd client
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173).

## Demo flow
1. Register two accounts in separate browser sessions.
2. Add teach/learn skills in Profile.
3. Open Discover and send an exchange request.
4. Log in as the other student and accept the request.
5. Schedule/complete a session, then submit a review.

## Important MVP notes
- Credits are awarded/spent when a session is marked completed; test with demo accounts before presenting.
- This is a college-project MVP, not production-hardened. Use HTTPS, strong secrets, database backups, rate limiting, and email verification before real public use.
- GitHub stores your source code; it does not run the Express API or MySQL database. Deploy frontend and API separately and configure environment variables.
