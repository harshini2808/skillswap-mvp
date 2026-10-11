# Deployment checklist (GitHub + live website)

## Push code to GitHub
1. Create a new GitHub repository named `skillswap`.
2. In the project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Build SkillSwap MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/skillswap.git
   git push -u origin main
   ```

## Deploy the database and API
1. Provision a hosted MySQL database (choose a provider that currently offers a free/low-cost plan; plan terms change).
2. Import `server/schema.sql` into that database.
3. Create a Node web service from the GitHub repository on a Node-compatible host.
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
4. Set environment variables from `server/.env.example` in the host dashboard. Use the hosted database's exact connection details and a strong random `JWT_SECRET`.
5. Confirm `https://YOUR-API-HOST/api/health` returns `{ "ok": true, "name": "SkillSwap API" }`.

## Deploy the frontend
1. Create a static site from the same GitHub repository on a static frontend host.
   - Root directory: `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
2. Add environment variable `VITE_API_URL=https://YOUR-API-HOST/api` (no trailing slash required).
3. Redeploy after setting the variable.
4. Update the API's `CLIENT_URL` environment variable to the exact deployed frontend origin and redeploy the API.
5. Test registration, login, skill editing, matching, request acceptance, session completion, credits, and reviews using two accounts.

## GitHub Pages note
GitHub Pages only serves static frontend files. It cannot host the Express API or MySQL database. A static demo can be published on Pages, but the full-stack version needs separately hosted API and database. Do not commit `.env` or real credentials.
