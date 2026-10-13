# PERCH — Design Reference

This is the full architecture reference for DBML Maker. It is long on purpose: **do not read it end to end**. Start
from [`AGENTS.md`](AGENTS.md) (the overview), then jump to the section the task needs — `CLAUDE.md` has a
"which section for which task" table. Section numbers are stable; link to them as `DESIGN.md §[fill in here]`.

Paths are relative to the repo root. `path::symbol` names a function or class inside a file; line numbers are
avoided because they drift.

**Keeping this current.** When a change alters a boundary, a public interface, a state machine, a role, or a
deploy step described here, update the matching section in the same commit. A wrong design doc is worse than
none.

## Contents

1. [System context](#1-system-context)
2. [Repository layout](#2-repository-layout)
3. [Backend architecture: the modular monolith](#3-backend-architecture-the-modular-monolith)
4. [Access control & security](#4-access-control--security)
10. [comms — notifications & outbound messaging](#10-comms--notifications--outbound-messaging)
12. [Smaller domain apps](#12-smaller-domain-apps)
13. [Background jobs](#13-background-jobs)
14. [Frontend architecture](#14-frontend-architecture)
15. [Data, schema & migrations](#15-data-schema--migrations)
16. [Testing](#16-testing)
17. [Build, deploy & release](#17-build-deploy--release)
18. [Known gaps, deviations & sharp edges](#18-known-gaps-deviations--sharp-edges)
19. [Glossary & requirement IDs](#19-glossary--requirement-ids)

---

## 1. System context

### 1.1 External systems

| System | Role | Boundary in code |
|--------|------|------------------|

### 1.2 Runtime shape

---

## 2. Repository layout

```
backend/               
frontend/               React 19 + Vite 8 SPA (§14)
Dockerfile              
docker-compose.yml      
README.md               Operational guide (deploy, auth setup, 
```

---

## 3. Backend architecture: the modular monolith

### 3.1 Principles

### 3.2 Anatomy of an app

```

```

### 3.3 App catalogue

|

