# Dashboard sector (Master + Salon)

This route group hosts two personas. Pick the right one before editing:

- **Solo master features** (calendar, clients, services, personal finance, inventory, settings) → invoke `/master-agent`, read `.agents/master-agent/SECTOR.md`
- **Team / salon features** (team/, shifts/, payrun/, equipment/, locations/, multi-master calendar, queue, segments, reports, campaigns) → invoke `/salon-agent`, read `.agents/salon-agent/SECTOR.md`
- Both affected → invoke both sequentially

After changes: update the corresponding SECTOR.md.

Full feature vision (user's raw words): `.knowledge/vision.md`. Design rules and anti-patterns per persona: `.agents/{master,salon}-agent/SKILL.md`.
