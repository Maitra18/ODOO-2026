# AssetFlow Frontend

A React + Vite website that connects to your AssetFlow Spring Boot backend.

## What's included right now
- Login page → calls `POST /auth/login`
- Signup page → calls `POST /auth/signup`
- Forgot password page → calls `POST /auth/forgot-password`
- Dashboard (protected) → calls `GET /notifications/unread-count` to prove the connection
- Notifications page (protected) → calls `GET /notifications`, `PATCH /notifications/read-all`
- Auto token refresh: if your access token expires, it silently calls `POST /auth/refresh-token` and retries

## How to run it

1. Make sure the backend is already running on `http://localhost:8080` (see assetflow-backend README).

2. Install dependencies:
   ```
   npm install
   ```

3. Start the dev server:
   ```
   npm run dev
   ```

4. Open the URL it prints (usually `http://localhost:5173`).

5. Click "Create one" to sign up, or log in if you already made a user via curl/Postman earlier.

## Where the "connection" actually happens

- `src/api/client.js` — the Axios instance. This is the single file that knows the backend's address (`VITE_API_BASE_URL` in `.env`) and attaches your JWT to every request.
- `src/api/auth.js` — the specific auth calls (login/signup/etc.)
- `src/context/AuthContext.jsx` — keeps the logged-in user in memory + localStorage, exposes `login()`, `signup()`, `logout()` to any page.
- `src/components/ProtectedRoute.jsx` — bounces you to `/login` if you're not authenticated.

## Changing the backend address

If your backend runs somewhere other than `localhost:8080`, edit `.env`:
```
VITE_API_BASE_URL=http://your-backend-host:8080/api
```

## Next modules to add here
Departments, Employee Directory, Asset Categories, Asset Registration, Allocations, Transfers, Bookings, Maintenance, Audits, Reports, Activity Logs — each will follow the same pattern: a file in `src/api/`, a page in `src/pages/`, a route in `App.jsx`.
