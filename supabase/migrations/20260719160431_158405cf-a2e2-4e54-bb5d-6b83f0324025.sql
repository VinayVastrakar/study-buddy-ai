REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Hide from pg_graphql (still available via PostgREST/Data API)
COMMENT ON TABLE public.profiles IS E'@graphql({"public": false})';
COMMENT ON TABLE public.notes_history IS E'@graphql({"public": false})';