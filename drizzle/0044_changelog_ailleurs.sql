-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for the others' events in Jeux and the Secret Santa copy (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-13', 'Secret Santa et Killer : une nouvelle section « Ailleurs au CLHUB » montre ce que les autres membres organisent, pour voir que le club vit. Et un bouton « Dupliquer » dans le panneau du Secret Santa reprend les participants et les règles, pour l''année prochaine.');
