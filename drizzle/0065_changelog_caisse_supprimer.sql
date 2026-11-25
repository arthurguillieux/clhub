-- Custom SQL migration file, put your code below! -- -- "Nouveautés" entry (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-25', 'Caisse commune : celui qui a créé un évènement peut maintenant le supprimer lui-même (bouton « Supprimer » à côté de « Modifier », avec ses dépenses et ses remboursements), sans passer par un admin.');
