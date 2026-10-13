import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server.js";
import {
  createDiagram,
  createShare,
  getDiagram,
  listDiagrams,
  listShares,
  restoreVersion,
  trashDiagram,
  updateDiagram,
} from "./diagrams.js";
import { duplicatePublicDiagram, getPublicDiagram } from "./public.js";

const diagram = { id: "d1", name: "Shop", change_number: 5, source: "", layout: {} };

describe("diagrams API", () => {
  it("DGM-002 getDiagram returns the diagram and the change number from ETag", async () => {
    server.use(
      http.get("*/api/v1/diagrams/d1", () =>
        HttpResponse.json(diagram, { headers: { ETag: '"5"' } }),
      ),
    );
    await expect(getDiagram("d1")).resolves.toEqual({ diagram, etag: 5 });
  });

  it("DGM-002 updateDiagram sends If-Match with the change number", async () => {
    let ifMatch = null;
    let body = null;
    server.use(
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        body = await request.json();
        return HttpResponse.json({ ...diagram, change_number: 6 }, { headers: { ETag: '"6"' } });
      }),
    );
    const result = await updateDiagram("d1", { source: "Table a {}" }, { etag: 5 });
    expect(ifMatch).toBe('"5"');
    expect(body).toEqual({ source: "Table a {}" });
    expect(result.etag).toBe(6);
  });

  it("DGM-002 updateDiagram throws diagram_conflict for 412", async () => {
    server.use(
      http.patch("*/api/v1/diagrams/d1", () =>
        HttpResponse.json(
          {
            error: {
              code: "diagram_conflict",
              message: "Conflict.",
              current: { change_number: 7 },
            },
          },
          { status: 412 },
        ),
      ),
    );
    await expect(updateDiagram("d1", { name: "x" }, { etag: 5 })).rejects.toMatchObject({
      status: 412,
      code: "diagram_conflict",
    });
  });

  it("VER-003 restoreVersion sends If-Match", async () => {
    let ifMatch = null;
    server.use(
      http.post("*/api/v1/diagrams/d1/versions/v1/restore", ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        return HttpResponse.json(diagram, { headers: { ETag: '"8"' } });
      }),
    );
    const result = await restoreVersion("d1", "v1", { etag: 7 });
    expect(ifMatch).toBe('"7"');
    expect(result.etag).toBe(8);
  });

  it("DGM-001 createDiagram returns the new diagram with its change number", async () => {
    server.use(
      http.post("*/api/v1/diagrams", () =>
        HttpResponse.json(diagram, { status: 201, headers: { ETag: '"1"' } }),
      ),
    );
    await expect(createDiagram({ name: "Shop" })).resolves.toEqual({ diagram, etag: 1 });
  });

  it("DGM-004 trashDiagram sends DELETE", async () => {
    server.use(http.delete("*/api/v1/diagrams/d1", () => new HttpResponse(null, { status: 204 })));
    await expect(trashDiagram("d1")).resolves.toBeUndefined();
  });

  it("listDiagrams sends scope, cursor, and page_size", async () => {
    let search = null;
    server.use(
      http.get("*/api/v1/diagrams", ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ results: [], next: null });
      }),
    );
    await listDiagrams({ scope: "trash", cursor: "c1", pageSize: 20 });
    expect(search).toBe("?scope=trash&cursor=c1&page_size=20");
  });

  it("SHR-001 listShares returns the array and createShare posts the body", async () => {
    const share = { id: "s1", email: "a@example.com", role: "viewer" };
    let body = null;
    server.use(
      http.get("*/api/v1/diagrams/d1/shares", () =>
        HttpResponse.json({ results: [share], next: null }),
      ),
      http.post("*/api/v1/diagrams/d1/shares", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(share, { status: 201 });
      }),
    );
    await expect(listShares("d1")).resolves.toEqual([share]);
    await createShare("d1", { email: "a@example.com", role: "viewer" });
    expect(body).toEqual({ email: "a@example.com", role: "viewer" });
  });
});

describe("public API", () => {
  it("SHR-002 getPublicDiagram reads the diagram for a token", async () => {
    const publicDiagram = {
      name: "Shop",
      source: "",
      layout: {},
      updated_at: "2026-01-01T00:00:00Z",
    };
    server.use(http.get("*/api/v1/public/tok", () => HttpResponse.json(publicDiagram)));
    await expect(getPublicDiagram("tok")).resolves.toEqual(publicDiagram);
  });

  it("duplicatePublicDiagram returns the diagram and the change number", async () => {
    server.use(
      http.post("*/api/v1/public/tok/duplicate", () =>
        HttpResponse.json(diagram, { status: 201, headers: { ETag: '"1"' } }),
      ),
    );
    await expect(duplicatePublicDiagram("tok")).resolves.toEqual({ diagram, etag: 1 });
  });
});
