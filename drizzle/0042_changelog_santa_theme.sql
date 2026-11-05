-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for the Secret Santa themes (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-05', 'Secret Santa : choisis ton thème dans les réglages. En plus du néon, voici le Noël blanc, un matin dans les sapins où la neige s''accumule pour de vrai sur la page, flocon après flocon. Tu peux aussi mettre un mot de passe pour partager l''organisation, comme au Killer.');
