// Test data for the tests of this feature.
export function summary(overrides = {}) {
  return {
    id: "d1",
    name: "Shop",
    role: "owner",
    change_number: 3,
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_by: { id: "u1", email: "ann@example.com", display_name: "Ann" },
    trashed_at: null,
    ...overrides,
  };
}
