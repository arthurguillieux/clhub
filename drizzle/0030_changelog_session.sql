-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-10-18', 'Correctif : tu restes maintenant connecté·e pendant un an au lieu d''une semaine. Il faudra te reconnecter une dernière fois par mail, puis c''est bon.');
