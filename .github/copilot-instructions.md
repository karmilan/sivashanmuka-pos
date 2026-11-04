
# Sivashanmuka-POS
## GitHub Copilot Project Instructions

### Project Context
Build a production-ready POS system for one business
operating two physical shops.

SIVASHANMUKA MULTY STORE — Shop 1 (Grocery)
SIVASHANMUKA SMART SHOP — Shop 2 (Grocery + Fancy/General Retail)

### Technology Stack
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- API: REST API
- Validation: Zod
- Server state: TanStack Query

### Architecture
- Use a modular monolith architecture.
- Keep business logic inside service layers.
- Keep route handlers thin.
- Separate frontend and backend.
- Use reusable components.
- Follow TypeScript strict mode.
- Avoid unnecessary dependencies.

### Business Rules
- Maintain separate inventory for each shop.
- Use a shared product catalogue.
- Never change stock without a stock movement.
- Completed sales must preserve historical product snapshots.
- Use database transactions for financial operations.
- Prevent duplicate sales using idempotency keys.
- Never silently delete completed financial records.
- Maintain supplier and cash ledgers.
- Enforce shop-level permissions on the backend.

### Database Rules
- Use Prisma migrations.
- Use PostgreSQL NUMERIC/DECIMAL for money
  and quantities.
- Use foreign keys and unique constraints.
- Use proper indexes.
- Never use JavaScript floating-point arithmetic
  as the authoritative money calculation.
- Preserve historical transaction records.

### Security
- Validate every API request.
- Enforce backend authorization.
- Use secure authentication sessions.
- Never expose secrets in frontend code.
- Never trust shop IDs or permissions from clients.
- Record sensitive operations in audit logs.

### Development Rules
- Write maintainable, reusable code.
- Follow existing project conventions.
- Do not introduce unnecessary architecture changes.
- Do not invent business requirements.
- Ask for clarification when a business rule is undefined.
- Write tests for important business logic.
- Explain database schema changes before applying them.
- Never remove existing functionality without approval.

### Important
The approved SHOP POS – YUVA Developer
Handover Plan is provided as a PDF file:

"docs\Shop_POS_Yuva_Developer_Plan.pdf"

Do not implement features outside the approved
MVP without explicit approval.
