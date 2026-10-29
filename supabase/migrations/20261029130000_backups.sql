-- De dagelijkse back-up (server/api/backup.get.ts, Vercel Cron): één SQL-bestand per dag in een besloten bucket,
-- 30 dagen bewaard. Geen policies: alleen de service-rol (de server) kan erbij, geen medewerker via de app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/sql', 'text/plain'])
on conflict (id) do nothing;
