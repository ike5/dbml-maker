// The source of a new diagram: two tables, one ref, and a table note (DGM-001).
export const STARTER_SOURCE = `Table users {
  id integer [pk, increment]
  email varchar [not null, unique]
  Note: 'A person who has an account.'
}

Table posts {
  id integer [pk, increment]
  title varchar [not null]
  user_id integer [not null]
}

Ref: posts.user_id > users.id
`;
