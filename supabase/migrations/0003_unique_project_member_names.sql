create unique index if not exists members_project_display_name_unique_idx
  on public.members(project_id, display_name);
