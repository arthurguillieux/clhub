-- Required by the exclusion constraint that makes double-booking a single
-- item physically impossible at the database level (see ADR in docs/02-architecture.md,
-- section "Le garde-fou anti-double-réservation").
CREATE EXTENSION IF NOT EXISTS btree_gist;
