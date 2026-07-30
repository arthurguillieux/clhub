CREATE TABLE "changelog_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed the first day of the "Nouveautés" log with today's highlights, so the
-- section isn't empty on first deploy. Later entries come from `pnpm changelog:add`.
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-07-30', 'Nouvelle section : Cabanes à dons — pour donner, échanger ou vendre des objets entre membres.'),
('2026-07-30', 'Ajout des régimes alimentaires et allergies sur les profils, utilisés automatiquement pour les menus du club.'),
('2026-07-30', 'L''agenda du club affiche maintenant les grands évènements du club (anniversaires, sorties...), en plus des disponibilités de chacun.'),
('2026-07-30', 'Les repas, la caisse commune et les évènements de l''agenda peuvent désormais être modifiés ou supprimés après coup par leur créateur ou un admin.'),
('2026-07-30', 'Nouveau bouton « Admin » dans le menu du haut, pour retourner facilement à l''espace admin.'),
('2026-07-30', 'Ajout d''un filtre par catégorie et d''une catégorie « Jeux de société » à la prêtothèque.'),
('2026-07-30', 'Les recettes affichent maintenant le nombre de parts.');
