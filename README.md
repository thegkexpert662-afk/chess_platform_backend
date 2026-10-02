# Chess Platform Backend

Server-authoritative Node.js backend for the Chess Platform.

## Setup
1. Copy .env.example to .env.
2. Create PostgreSQL database chess_platform.
3. Run database/schema.sql.
4. Run npm install.
5. Run npm run dev.

Health endpoint: GET /api/health

The client is not trusted with the final game state. Game moves are authenticated and processed by the server.
