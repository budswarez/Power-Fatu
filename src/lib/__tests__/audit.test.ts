// audit.ts is tightly coupled to Firebase — these tests validate the exported types only

import type { AuditAction, AuditEntity, AuditEntry } from "../audit";

describe("AuditEntry types", () => {
  it("AuditAction values are valid string literals", () => {
    const actions: AuditAction[] = ["create", "update", "delete"];
    expect(actions).toHaveLength(3);
  });

  it("AuditEntity values are valid string literals", () => {
    const entities: AuditEntity[] = ["sale", "channel", "user", "settings"];
    expect(entities).toHaveLength(4);
  });

  it("AuditEntry shape has required fields", () => {
    const entry: AuditEntry = {
      id: "test-id",
      action: "create",
      entity: "sale",
      entity_id: "sale-123",
      uid: "user-uid",
      user_name: "João Silva",
      timestamp: new Date(),
      payload: { amount: 100 },
    };
    expect(entry.id).toBe("test-id");
    expect(entry.action).toBe("create");
    expect(entry.payload).toEqual({ amount: 100 });
  });
});
