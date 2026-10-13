// Hand-written parse results for the tests of the canvas (DESIGN.md §13.2).
const column = (name, type = "int", extra = {}) => ({
  name,
  type,
  pk: false,
  notNull: false,
  unique: false,
  increment: false,
  default: null,
  note: null,
  ...extra,
});

const table = (name, columns, extra = {}) => ({
  key: `public.${name}`,
  schema: "public",
  name,
  alias: null,
  note: null,
  headerColor: null,
  columns,
  indexes: [],
  ...extra,
});

export function makeParseResult() {
  return {
    project: null,
    tables: [
      table("users", [
        column("id", "int", { pk: true, notNull: true }),
        column("email", "varchar"),
      ]),
      table("orders", [column("id", "int", { pk: true }), column("user_id", "int")]),
      table("items", [column("id", "int", { pk: true }), column("order_id", "int")]),
    ],
    refs: [
      {
        key: "ref:orders.user_id>users.id",
        from: { tableKey: "public.orders", columns: ["user_id"] },
        to: { tableKey: "public.users", columns: ["id"] },
        cardinality: "n-1",
        onDelete: null,
        onUpdate: null,
      },
      {
        key: "ref:items.order_id>orders.id",
        from: { tableKey: "public.items", columns: ["order_id"] },
        to: { tableKey: "public.orders", columns: ["id"] },
        cardinality: "n-1",
        onDelete: null,
        onUpdate: null,
      },
    ],
    enums: [],
    groups: [{ name: "shop", tableKeys: ["public.orders", "public.items"], color: "#ff0000" }],
  };
}
