# Project: NestJS Bitrix24 RESTful API

## Architecture
- Framework: NestJS 10 (TypeScript, Node.js >= 18)
- Persistence: SQLite with TypeORM (`@nestjs/typeorm`, `typeorm`, `sqlite3`)
- HTTP Client: `@nestjs/axios` with `axios`
- API Documentation: `@nestjs/swagger`, `swagger-ui-express`
- Validation: `class-validator`, `class-transformer`
- Security: Custom `ApiKeyGuard` enforcing `x-api-key` header
- Modular Structure:
  - `DatabaseModule`: SQLite connection and `BitrixToken` repository
  - `Bitrix24Module`: Centralized Bitrix24 client service with OAuth token lifecycle management, proactive/reactive auto-refresh, and error resilience
  - `AuthModule`: Public OAuth `/install` endpoints handling both GET redirect codes and POST iframe payloads
  - `ContactsModule`: Protected RESTful API (`/contacts`) orchestrating CRM Contacts and Banking Requisites (2-level hierarchy: Contact -> Requisite -> Bank Detail)
  - `CommonModule` / Filters & Guards: `ApiKeyGuard`, `HttpExceptionFilter`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | App Install Endpoint (`/install`) | Receives installation redirect/payload from Bitrix24; extracts code or direct tokens | M2 | Survey / PDF P1 §1 |
| 2 | OAuth Token Exchange | Exchanges auth code with `https://oauth.bitrix.info/oauth/token/` | M2 | Survey / PDF P1 §1-2 |
| 3 | SQLite Token Entity (`BitrixToken`) | TypeORM entity saving token credentials to local SQLite database | M1 | Survey / ORIGINAL_REQUEST R1 |
| 4 | Automatic Token Refresh | Proactive and reactive refresh using `refresh_token` | M2 | Survey / PDF P1 §3 |
| 5 | Generic Bitrix24 API Client (`callBitrixAPI`) | Centralized HTTP client wrapper with auth injection, logging, and retry | M2 | Survey / PDF P1-2 §4-5 |
| 6 | `GET /contacts` | Retrieves list of contacts combined with their banking requisites | M3 | Survey / PDF P2 §2 |
| 7 | `POST /contacts` | Creates contact on Bitrix24, then creates and links banking requisite & bank details | M3 | Survey / PDF P2 §2-3 |
| 8 | `PUT /contacts/:id` | Updates contact details and banking requisites for specified contact ID with 404 handling | M3 | Survey / PDF P2 §2-3 |
| 9 | `DELETE /contacts/:id` | Deletes contact and associated requisites from Bitrix24 with 404 handling | M3 | Survey / PDF P2 §2-3 |
| 10 | API Key Authentication (`ApiKeyGuard`) | Protects CRM endpoints via custom NestJS CanActivate Guard using `x-api-key` header | M4 | Survey / PDF P2 §5 |
| 11 | Global Validation Pipe & DTO Rules | Strict payload validation using `class-validator` (RFC 5322 email, phone regex) | M3 | Survey / PDF P2 §4 |
| 12 | Swagger OpenAPI (`/docs`) | Auto-generated interactive API documentation with `x-api-key` authorization button | M4 | Survey / PDF P3 §Gợi ý |
| 13 | ngrok Guide & Documentation | Public HTTPS tunneling guide, local app registration instructions, professional README.md | M4 | Survey / PDF P1-2 §6 |
| 14 | Automated Unit Test Suite | Jest test suites for `Bitrix24Service` (mocking axios), `ContactsService`, and `ApiKeyGuard` | M5 | Survey / PDF P3 §3 |
| 15 | TypeScript Compilation & Clean Build | Production build script `npm run build` with 0 TypeScript/ESLint errors | M5 | Survey / PDF P3 §1 |
| 16 | E2E Acceptance & Adversarial Hardening | Verification of 100% passing E2E test suite (Tiers 1-4) and Tier 5 adversarial testing | M6 | Survey / Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Scaffolding & Database | Project scaffold in `d:/AASC/danh-gia-api-nestjs`, TypeORM SQLite setup, `BitrixToken` entity, `ConfigModule`, `.env.example`, `HttpExceptionFilter` | none | DONE |
| M2 | OAuth 2.0 & Bitrix24 Client | `/install` endpoint, token exchange, persistence, proactive/reactive auto-refresh, `callBitrixAPI` with logging & error resilience | M1 | DONE |
| M3 | Contacts & Banking Requisites API | `CreateContactDto`, `UpdateContactDto`, `ContactsService`, `ContactsController` (GET, POST, PUT, DELETE `/contacts` with Bitrix24 Contact -> Requisite -> Bank Detail hierarchy) | M2 | IN_PROGRESS |
| M4 | Security, Swagger & Documentation | `ApiKeyGuard` (`x-api-key`), Swagger OpenAPI at `/docs` with security scheme, ngrok setup guide, clean `README.md` | M3 | PLANNED |
| M5 | Unit Test Suite & Build Cleanliness | Comprehensive Jest unit tests (`Bitrix24Service`, `ContactsService`, `ApiKeyGuard`), 100% pass on `npm test`, clean `npm run build` | M4 | PLANNED |
| M6 | Final Milestone: E2E Pass & Hardening | Phase 1: Pass 100% of E2E tests (Tiers 1-4); Phase 2: Adversarial Coverage Hardening (Tier 5) | M5, TEST_READY | PLANNED |

## Interface Contracts

### `DatabaseModule` ↔ `Bitrix24Module` & `AuthModule`
- Entity: `BitrixToken`
  - Columns: `id: number`, `domain: string (unique)`, `accessToken: string`, `refreshToken: string`, `expiresAt: Date`, `memberId: string`, `clientEndpoint: string`, `createdAt: Date`, `updatedAt: Date`
  - Method: `isExpired(): boolean` -> returns `Date.now() >= expiresAt.getTime() - 60000`

### `Bitrix24Module` ↔ `ContactsModule` & `AuthModule`
- `Bitrix24Service`:
  - `callBitrixAPI<T = any>(method: string, payload?: Record<string, any>, domain?: string): Promise<T>`
  - `getValidToken(domain?: string): Promise<BitrixToken>`
  - `refreshToken(token: BitrixToken): Promise<BitrixToken>`
  - `saveToken(tokenData: Partial<BitrixToken>): Promise<BitrixToken>`

### `ContactsModule` ↔ External Clients
- Protected by `ApiKeyGuard` (`x-api-key: <API_KEY>`)
- `GET /contacts`: returns `ContactResponseDto[]`
- `POST /contacts`: body `CreateContactDto`, returns `201 Created` with created contact & banking details
- `PUT /contacts/:id`: param `id: number`, body `UpdateContactDto`, returns `200 OK` or `404 Not Found`
- `DELETE /contacts/:id`: param `id: number`, returns `200 OK` `{ statusCode: 200, message: string, id: number }` or `404 Not Found`

## Code Layout
```
d:/AASC/danh-gia-api-nestjs/
├── src/
│   ├── common/
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   └── api-key.guard.ts
│   │   └── interfaces/
│   │       └── api-response.interface.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── entities/
│   │       └── bitrix-token.entity.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── bitrix24/
│   │   │   ├── bitrix24.service.ts
│   │   │   ├── bitrix24.module.ts
│   │   │   └── bitrix24.service.spec.ts
│   │   └── contacts/
│   │       ├── contacts.controller.ts
│   │       ├── contacts.service.ts
│   │       ├── contacts.module.ts
│   │       ├── contacts.service.spec.ts
│   │       └── dto/
│   │           ├── create-contact.dto.ts
│   │           └── update-contact.dto.ts
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── api-key.guard.spec.ts
│   └── app.e2e-spec.ts
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
├── README.md
└── tsconfig.json
```
