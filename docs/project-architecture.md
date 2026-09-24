# Architecture of the projects the site describes

The portfolio page summarises two systems in a few lines each. This file carries the diagrams
behind those summaries, as [Mermaid](https://mermaid.js.org/) source so GitHub renders them and a
pull request reviews them like any other change — a committed PNG would have gone stale silently.

Anything planned, or present but not wired in, is drawn with a dashed border and says so.

The architecture of this repository (the site and the SQL playground) is in the
[README](../README.md).

## DataForge — business Excel files to a serverless dashboard

Client code is private. This is the anonymized architecture described in the
[case study](https://github.com/juanberrio0399/portfolio/blob/main/case-studies/01-dataforge-customs-reconciliation_EN.md).
The heavy path reads the courier's Excel exports on a PC because doing that volume in the cloud
would cost money; the light sources never touch that machine.

```mermaid
flowchart LR
  XL["Business Excel files<br/>SharePoint / OneDrive"]

  subgraph HEAVY["Heavy path - on-premises PC, Task Scheduler 3x/day"]
    direction TB
    CAT["catalog.json<br/>modified time per file"] -.->|"only changed files"| RD
    RD["readers.py<br/>parallel Excel read"] --> TR["transforms.py<br/>cleaning, typing, join keys"]
    TR --> WR["writers.py<br/>incremental dedup -> Parquet"]
    WR --> WH[("DuckDB warehouse<br/>one view per source")]
  end

  subgraph LIGHT["Light path - fully in the cloud"]
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

  subgraph SERVE["Serving - Cloudflare Pages behind Cloudflare Access"]
    direction TB
    FN["Pages Function<br/>R2 binding"] --> APP["React + DuckDB-WASM<br/>SQL runs in the browser"]
  end
  R2 --> FN
```

The cloud steps of the daily run are deliberately non-critical: if the R2 sync fails the local
warehouse is still correct and the run reports which step was skipped.

## Serverless RAG Assistant

Source: [serverless-rag-assistant](https://github.com/juanberrio0399/serverless-rag-assistant) — one
Cloudflare Worker whose bindings (Workers AI, Vectorize, D1, Workflows, rate limiting) are declared
in `wrangler.jsonc`.

```mermaid
flowchart LR
  subgraph INGEST["Ingestion - Bearer INGEST_TOKEN"]
    direction TB
    DOC["Text, or a public URL"] -->|"POST /ingest-url"| JINA["Jina Reader<br/>page -> Markdown"]
    DOC -->|"POST /ingest"| CHUNK
    JINA --> CHUNK["Structure-aware chunking<br/>~800-char target, 100 chunks max"]
    CHUNK --> EMB["Workers AI<br/>bge-base-en-v1.5, 768 dims"]
    JOBS["POST /ingest-jobs<br/>long documents"] --> WF["Workflow rag-ingest<br/>one retryable step per 50 chunks"]
    WF --> EMB
  end

  subgraph ASK["POST /ask"]
    direction TB
    Q["Question"] --> QEMB["Workers AI<br/>embed the question"]
    RR["Workers AI<br/>bge-reranker-base, score >= 0.4"] --> MODE{"reasoning?"}
    MODE -->|"no (default)"| FAST["llama-3.3-70b-instruct-fp8-fast<br/>Groq fallback if GROQ_API_KEY is set"]
    MODE -->|"yes"| R1["deepseek-r1-distill-qwen-32b"]
    MEM[("D1 rag-memory<br/>last 5 turns per conversationId<br/>7-day retention")] -.-> MODE
  end

  EMB --> VEC[("Vectorize<br/>rag-index")]
  QEMB --> VEC
  VEC -->|"top candidates"| RR
  RL["Rate limiting binding<br/>20 requests / 60 s per IP"] -.-> INGEST
  RL -.-> ASK
  TFR["Terraform"] -.->|"provisions"| BUCKET[("R2 bucket<br/>rag-source-docs - not bound yet")]
  classDef planned stroke-dasharray: 5 5
  class BUCKET planned
```

Ingestion is closed unless the `INGEST_TOKEN` secret exists — without it `/ingest` and
`/ingest-url` answer 503 rather than accepting anonymous documents. The `ask:` and `ingest:` rate
limits are counted separately, so ingesting does not lock a visitor out of asking.
