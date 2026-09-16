# E2E Test Infra: NestJS Bitrix24 RESTful API

## Test Philosophy
- Opaque-box, requirement-driven, testing external interface contracts as an end-user / Bitrix24 server would.
- Zero dependency on internal NestJS class or service implementations.
- Verification channels: HTTP status codes, JSON schema validation, response headers, SQLite persistence side-effects, and simulated Bitrix24 webhooks/callbacks.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workloads.

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---------|-------------------|:----------------:|:-----------------:|:-----------------:|:-------------------:|
| 1 | OAuth Install (`/install`) | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ | ✓ |
| 2 | Token Refresh Logic | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ | ✓ |
| 3 | `POST /contacts` | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 4 | `GET /contacts` | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 5 | `PUT /contacts/:id` | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 6 | `DELETE /contacts/:id` | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 7 | `ApiKeyGuard` (`x-api-key`) | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 8 | Swagger OpenAPI (`/docs`) | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Node.js / Jest E2E runner (`test/app.e2e-spec.ts` or standalone executable test script `test/e2e-runner.js`).
- Pass/Fail Semantics: Exit code 0 if all tests pass, non-zero if any test fails.
- Output: Structured report detailing tests run, passed, failed, and assertion logs.

## Coverage Thresholds
- Tier 1: Feature Coverage (≥5 per feature) -> Minimum 40 test cases
- Tier 2: Boundary & Corner Cases (≥5 per feature) -> Minimum 40 test cases
- Tier 3: Cross-Feature Interactions -> Minimum 8 pairwise interaction cases
- Tier 4: Real-World Scenarios -> Minimum 5 end-to-end user workflows
- Total Minimum Target: ~93+ test assertions

## Publication Signal
When complete, the E2E Testing Track will publish `d:/AASC/TEST_READY.md`.
