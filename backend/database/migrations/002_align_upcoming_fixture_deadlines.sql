UPDATE fixtures
SET deadline = match_date
WHERE status = 'upcoming'
  AND deadline IS DISTINCT FROM match_date;
