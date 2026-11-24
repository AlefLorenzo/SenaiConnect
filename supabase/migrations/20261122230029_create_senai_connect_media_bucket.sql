insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'senai-connect-media',
  'senai-connect-media',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read SENAI Connect media" on storage.objects;
create policy "Public can read SENAI Connect media"
on storage.objects
for select
to public
using (bucket_id = 'senai-connect-media');
