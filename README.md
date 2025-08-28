# Bookings Service

A minimal microservice for managing bookings, built with **NestJS**, **PostgreSQL**, **Redis**, and **WebSockets**.

---

## Assumptions & Decisions

* **Entities**:

  * `User`: only users can create bookings.
  * `Provider`: can view bookings assigned to them.
  * `Admin`: can view all bookings.
* **Auth & Roles**: JWT-based with role guards (`user`, `provider`, `admin`).
* **Real-time updates**: WebSockets (via Redis pub/sub) emit `booking.created` events.
* **Reminders**: Sent \~10 minutes before a booking (currently implemented in-memory; see improvements).
* **Schema**: Modeled with Prisma & PostgreSQL.
* **Simple WebSocket Test**: A `test.html` file is provided to verify client → server WebSocket connectivity.

---

## Setup Instructions

1. Clone repo

2. Copy `.env.example` → `.env` and update values

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run DB migrations:

   ```bash
   npx prisma migrate dev
   ```

---

## How to Run Locally & Test

### Local run

```bash
npm run start:dev
```

### With Docker

```bash
docker-compose up --build
```

### Testing

```bash
npm run test
npm run test:e2e
```

### WebSocket Test

Open `test.html` in a browser — it will attempt to connect to `ws://localhost:3000` and log messages to console.

---

## API Endpoints

* `POST /v1/bookings` → Create booking (User only)
* `GET /v1/bookings/:id` → Get booking by ID (role-checked)
* `GET /v1/bookings?type=upcoming|past&page=&limit=` → Paginated list (role-checked)
* `GET /health` → Service health (DB + Redis)
* `GET /metrics` → JSON metrics
* `GET /metrics.prom` → Prometheus metrics

---

## What I’d Improve

### ✅ Validation & Correctness

* Enforce **startTime** must be in the future.
* Enforce **endTime > startTime** via custom validator.
* Password strength validation: require uppercase, lowercase, digit, special char, min length 8.

### ✅ Observability

* Replace `console.error` with NestJS **Logger** for structured logs (with context).
* Add request/response logging middleware for debugging.

### ✅ Reliability

* Introduce **Bull (Redis-backed job queue)** for reminder scheduling:

  * Delayed jobs survive service restarts.
  * Retries + dead-letter queue for failed jobs.

### ✅ Security

* Stronger password policy (see above).
* Stricter JWT secret/key handling (env vault, rotation).
* Role-based access already in place, but could expand to **attribute-based checks**.

### ✅ Scalability

* Add caching layer (Redis) for frequently accessed bookings.
* DB connection pooling (PgBouncer / Prisma driver config).

### ✅ Developer Experience

* Add OpenAPI/Swagger docs.
* Typed SDK client for consuming services.
* More unit/integration tests around WebSockets & edge cases.

---

## License

MIT

