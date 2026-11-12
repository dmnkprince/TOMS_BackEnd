# TOMS (Traffic Offence Management System) — Backend REST API

A secure, scalable REST API backend for the **Traffic Offence Management System (TOMS)** built with **Node.js, Express.js (ES Modules), Supabase, and PostgreSQL**.

---

## 1. Project Architecture

The database strictly implements the approved **7-table architecture**:
1. `profiles` — Enforcement personnel, supervisors, administrators.
2. `locations` — Predefined enforcement zones/locations and support for custom locations.
3. `offence_types` — Statutory traffic violations, categories, penalty fines, and demerit points.
4. `incidents` — Encounter records storing a **vehicle details snapshot** (no dedicated vehicle table).
5. `incident_offences` — Many-to-many junction recording one or more violations per incident.
6. `correction_requests` — Formal agent amendment submissions (approved/rejected transactionally).
7. `audit_logs` — Immutable audit trail of operational actions.

---

## 2. Default Seed Accounts

All default accounts have password: **`Password123!`**

| Role | Name | Email | Badge Number |
| :--- | :--- | :--- | :--- |
| **Admin** | Commander Sarah Jenkins | `admin@toms.gov` | `ADMIN-001` |
| **Supervisor** | Supervisor Marcus Adebayo | `supervisor@toms.gov` | `SUP-002` |
| **Agent** | Officer David Okafor | `officer.david@toms.gov` | `AGT-101` |
| **Agent** | Officer Aisha Bello | `officer.aisha@toms.gov` | `AGT-102` |

---

## 3. Getting Started

### Step 1: Execute Database Setup in Supabase
1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to **SQL Editor** -> **New query**.
3. Copy the entire contents of [`sql/complete_setup.sql`](./sql/complete_setup.sql) and paste into the editor.
4. Click **Run**. All 7 tables, indexes, atomic functions, and seed data will be created!

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and verify your connection string and keys:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
JWT_SECRET=toms_super_secret_jwt_key_2026_secure_traffic_enforcement
JWT_EXPIRES_IN=24h
CORS_ORIGIN=*
```

> **Note on IPv6 / Direct vs Pooler Connection:**
> If your ISP does not route direct IPv6 connections to `db.[PROJECT-REF].supabase.co`, use the Supabase **Connection Pooler** URI available in **Project Settings -> Database -> Connection string -> Mode: Session**.

### Step 3: Run the Server
```bash
# Start development server with hot-reload
npm run dev

# Or start standard production server
npm start
```
- API Base: `http://localhost:5000/api/v1`
- Health check: `http://localhost:5000/api/v1/health`

---

## 4. REST API Endpoint Reference & Frontend Integration

All endpoints expect `Authorization: Bearer <token>` in headers (except `/auth/login`).

### 4.1 Authentication (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
```json
// Request Body
{
  "email": "officer.david@toms.gov",
  "password": "Password123!"
}
```
**Frontend Fetch Example:**
```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { data } = await response.json();
localStorage.setItem('toms_token', data.token);
```

#### `GET /api/v1/auth/me`
Retrieves authenticated user profile and permissions.

---

### 4.2 Vehicle Information Lookup (`/api/v1/vehicles`)

#### `GET /api/v1/vehicles/lookup/:plateNumber`
Retrieves the most recent vehicle snapshot recorded in prior encounters without altering historical records.

**Frontend Fetch Example:**
```javascript
const response = await fetch(`http://localhost:5000/api/v1/vehicles/lookup/ABC123XY`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { data } = await response.json();
// data: { found: true, vehicle: { make, model, color, type, owner, license }, total_prior_incidents: 3 }
```

---

### 4.3 Incident Registration & Search (`/api/v1/incidents`)

#### `POST /api/v1/incidents`
Atomically records incident + vehicle snapshot + one or more offences + audit log.

```json
// Request Body
{
  "plate_number": "KJA-829-XP",
  "body_number": "TX-4401",
  "vehicle_make": "Toyota",
  "vehicle_model": "Corolla",
  "vehicle_color": "Blue",
  "vehicle_type": "Sedan",
  "vehicle_owner_name": "John Doe",
  "vehicle_owner_phone": "+2348033000000",
  "driver_license_number": "DL-908122",
  "driver_name": "John Doe",
  "location_id": "...", // UUID or omit and provide manual_location
  "manual_location": "Mile 12 Bus Stop, Ikorodu Road",
  "location_description": "Northbound lane near pedestrian bridge",
  "remarks": "Driver refused initial stop request",
  "offences": [
    { "offence_type_id": "...", "fine_amount": 25000, "notes": "Disobeyed red traffic light" },
    { "offence_type_id": "...", "notes": "Failure to produce driving license" }
  ]
}
```

#### `GET /api/v1/incidents`
Advanced multi-filter search with pagination and deduplication.
**Query Parameters:**
- `plate_number`: Partial or exact plate string
- `body_number`: Commercial vehicle body number
- `vehicle_type`: Sedan, SUV, Motorcycle, Truck, etc.
- `vehicle_make`: Toyota, Honda, Mercedes, etc.
- `category`: Offence category (e.g. `Speeding`, `Safety`)
- `agent_id`: UUID of recording officer
- `location_id`: UUID of enforcement zone
- `start_date` / `end_date`: ISO date range filters
- `page` (default 1) & `limit` (default 20)

---

### 4.4 Correction Requests (`/api/v1/corrections`)

#### `POST /api/v1/corrections`
Submits proposed amendments to an incident record.

```json
{
  "incident_id": "c1f7a184-...",
  "reason": "Plate number was entered with a typographical error (O instead of 0).",
  "proposed_changes": {
    "plate_number": "KJA-820-XP"
  }
}
```

#### `PATCH /api/v1/corrections/:id/review` (Supervisors and Admins)
Approves or rejects correction request. On approval, applies changes transactionally and generates an audit log.

```json
{
  "status": "approved" // or "rejected"
}
```

---

### 4.5 Offence Types (`/api/v1/offence-types`)
- `GET /api/v1/offence-types` — Lists all active traffic offences for selection in incident forms.
- `POST /api/v1/offence-types` (Admin) — Add new violation type.
- `PUT /api/v1/offence-types/:id` (Admin) — Edit fine amount or description.
- `PATCH /api/v1/offence-types/:id/toggle-status` (Admin) — Toggle active status.

---

### 4.6 Locations (`/api/v1/locations`)
- `GET /api/v1/locations` — Lists predefined enforcement zones and corridors.
- `POST /api/v1/locations` (Supervisor / Admin) — Add predefined zone.

---

### 4.7 Reports & Analytics (`/api/v1/reports`)
- `GET /api/v1/reports/summary` — Total incidents, fines levied, vehicles encountered, today's totals.
- `GET /api/v1/reports/top-offences` — Top infractions ranked by frequency.
- `GET /api/v1/reports/agent-performance` — Activity & fines breakdown by officer.
- `GET /api/v1/reports/location-hotspots` — Highest traffic violation corridors.

---

### 4.8 Audit Logs (`/api/v1/audit-logs`)
- `GET /api/v1/audit-logs` — Immutable audit trail with pagination and filters.

---

## 5. Security & Verification

- **Role-Based Access Control (RBAC):** Backend permissions enforced at the route level via `authorize([...])`.
- **Input Sanitization & Validation:** Strict schema validation with **Zod** on all input payloads.
- **Rate Limiting:** Protects against brute-force and DDoS via `express-rate-limit`.
- **Database Transactions:** ACID compliance for multi-record operations (incident creation and correction approval).
