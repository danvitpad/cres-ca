# .agents/ — Claude Code agents для CRES-CA

Категоризированы так же, как `D:/toolbox/agents/`. Таксономия — единая.

| Папка | Что сюда | В CRES-CA сейчас |
|---|---|---|
| `personas/` | Доменные роли (client/master/salon) | `client-agent`, `master-agent`, `salon-agent` |
| `frontend/` | UI-специалисты | — |
| `backend/` | API / Supabase / RLS | — |
| `research/` | Explorers, analysts | — |
| `data/` | Scrapers, RAG | — |
| `devops/` | Deploy, CI | — |

**Protocol:** перед правками в секторе → вызвать persona-агента → после правок обновить `SECTOR.md`.

Универсальные (не-persona) шаблоны живут в `D:/toolbox/agents/<category>/` и копируются сюда только когда реально используются в CRES-CA.
