# juanberrio0399.github.io

[![Lighthouse CI](https://github.com/juanberrio0399/juanberrio0399.github.io/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/juanberrio0399/juanberrio0399.github.io/actions/workflows/lighthouse.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/juanberrio0399/juanberrio0399.github.io/badge)](https://scorecard.dev/viewer/?uri=github.com/juanberrio0399/juanberrio0399.github.io)

Interactive portfolio of **Juan Berrio** — Cloud & Data Engineer.

🔗 Live: https://juanberrio0399.github.io

Static site (HTML + CSS + vanilla JS): project tabs, scroll-reveal animations, a print-to-PDF
version for recruiters and an EN/ES language toggle. No build step — served directly by GitHub Pages.

## 🏗️ Architecture (diagrams as code)

The diagrams below are [Mermaid](https://mermaid.js.org/) source that GitHub renders natively, so they
live next to the code, are reviewed in pull requests like any other change and never go stale as
committed images. Each one describes what the project actually runs today; anything that is planned,
or exists but is not wired in yet, is drawn with a dashed border and says so.

### This site

```mermaid
flowchart LR
  PR["Pull request"] --> HR
  subgraph CI["GitHub Actions · every action pinned by commit SHA"]
    direction TB
    HR["Harden-Runner<br/>egress audit"] --> LH["Lighthouse, 3 runs<br/>accessibility · best practices · SEO ≥ 0.9"]
    HR --> SC["OpenSSF Scorecard<br/>weekly + main · SARIF"]
  end
  SC --> CS["Code scanning alerts<br/>Security tab"]
  LH -->|"checks pass → merge"| MAIN["main branch"]
  MAIN --> PAGES["GitHub Pages<br/>deploy from branch, no build step"]
  PAGES --> USER["Visitor's browser<br/>Content-Security-Policy via meta tag"]
  MAIN -.-> TF["Terraform · DNS and security<br/>(planned)"]
  classDef planned stroke-dasharray: 5 5
  class TF planned
```

### DataForge — Excel to a serverless dashboard

Client code is private; this is the anonymized architecture described in the
[case study](https://github.com/juanberrio0399/portfolio/blob/main/case-studies/01-dataforge-customs-reconciliation_EN.md).

```mermaid
flowchart LR
  XL["Business Excel files<br/>SharePoint / OneDrive"]

  subgraph HEAVY["Heavy path · on-premises PC, Task Scheduler 3×/day"]
    direction TB
    CAT["catalog.json<br/>modified time per file"] -.->|"only changed files"| RD
    RD["readers.py<br/>parallel Excel read"] --> TR["transforms.py<br/>cleaning · typing · join keys"]
    TR --> WR["writers.py<br/>incremental dedup → Parquet"]
    WR --> WH[("DuckDB warehouse<br/>one view per source")]
  end

  subgraph LIGHT["Light path · fully in the cloud"]
    direction TB
    PA["Power Automate<br/>detects file changes"] --> WK["Cloudflare Worker<br/>validates and stores the file"]
    WK -->|"workflow_dispatch"| GA["GitHub Actions<br/>Python ingestion job"]
  end

  XL --> RD
  XL --> PA
  WH -->|"Parquet sync"| R2[("Cloudflare R2<br/>raw files and Parquet")]
  WK -->|"raw file"| R2
  R2 -.->|"reads raw files"| GA
  GA -->|"Parquet"| R2

  subgraph SERVE["Serving · Cloudflare Pages behind Cloudflare Access"]
    direction TB
    FN["Pages Function<br/>R2 binding"] --> APP["React + DuckDB-WASM<br/>SQL runs in the browser"]
  end
  R2 --> FN
```

### Serverless RAG Assistant

Source: [serverless-rag-assistant](https://github.com/juanberrio0399/serverless-rag-assistant) — a single
Cloudflare Worker whose bindings are declared in `wrangler.jsonc`.

```mermaid
flowchart LR
  subgraph INGEST["POST /ingest · /ingest-url (Bearer token)"]
    direction TB
    DOC["Text, or a public URL"] -->|"/ingest-url"| JINA["Jina Reader<br/>page → Markdown"]
    DOC -->|"/ingest"| CHUNK["Chunking<br/>800 chars · max 100 chunks"]
    JINA --> CHUNK
    CHUNK --> EMB["Workers AI<br/>bge-base-en-v1.5 embeddings"]
  end

  subgraph ASK["POST /ask"]
    direction TB
    Q["Question"] --> QEMB["Workers AI<br/>embed the question"]
    RR["Workers AI<br/>bge-reranker-base"] --> MODE{"mode"}
    MODE -->|"fast (default)"| FAST["llama-3.3-70b-instruct-fp8-fast<br/>optional Groq fallback"]
    MODE -->|"reasoning"| R1["deepseek-r1-distill-qwen-32b"]
  end

  EMB --> VEC[("Vectorize<br/>rag-index")]
  QEMB --> VEC
  VEC -->|"top candidates"| RR
  RL["Rate limiting binding<br/>20 requests / 60 s per IP"] -.-> INGEST
  RL -.-> ASK
  TFR["Terraform"] -.->|"provisions"| BUCKET[("R2 bucket<br/>rag-source-docs · not bound yet")]
  classDef planned stroke-dasharray: 5 5
  class BUCKET planned
```

## 🔒 Security

Actions are pinned by commit SHA, workflows run with least-privilege `permissions:` and
Dependabot opens one grouped pull request a week so those pins do not go stale. OpenSSF
Scorecard scores the supply-chain posture weekly and uploads its SARIF to code scanning.
How to report a vulnerability: [SECURITY.md](SECURITY.md).

## 🔮 Roadmap Técnico

Próxima fase: Migración a despliegue automatizado mediante GitHub Actions y gestión de DNS/Seguridad mediante Terraform para reflejar prácticas reales de Cloud Engineering.
