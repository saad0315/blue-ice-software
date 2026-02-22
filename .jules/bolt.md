## 2024-05-22 - Vitest Mock Hoisting
**Learning:** When using `vitest-mock-extended` with `vi.mock`, local variables (like `dbMock`) cannot be used inside the mock factory because of hoisting.
**Action:** Use `vi.hoisted(() => { ... })` to define mock objects that need to be shared between the mock factory and the test body.
