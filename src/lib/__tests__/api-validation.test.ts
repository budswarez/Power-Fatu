import { z } from "zod";

// Replicate the schema from the API route to test it in isolation
const ROLES = ["user", "gerente", "admin"] as const;

const patchBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128).optional(),
  role: z.enum(ROLES).optional(),
});

describe("PATCH /api/users/[uid] body validation", () => {
  it("accepts valid full body", () => {
    const result = patchBodySchema.safeParse({
      name: "João Silva",
      email: "joao@empresa.com",
      password: "senha123",
      role: "gerente",
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial body (name only)", () => {
    const result = patchBodySchema.safeParse({ name: "João" });
    expect(result.success).toBe(true);
  });

  it("accepts empty body (no-op)", () => {
    const result = patchBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = patchBodySchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toBeDefined();
  });

  it("rejects password shorter than 6 chars", () => {
    const result = patchBodySchema.safeParse({ password: "abc" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password).toBeDefined();
  });

  it("rejects invalid role value", () => {
    const result = patchBodySchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.role).toBeDefined();
  });

  it("rejects empty name", () => {
    const result = patchBodySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 120 chars", () => {
    const result = patchBodySchema.safeParse({ name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of ROLES) {
      const result = patchBodySchema.safeParse({ role });
      expect(result.success).toBe(true);
    }
  });
});
