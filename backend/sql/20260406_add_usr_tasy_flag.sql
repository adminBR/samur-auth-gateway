ALTER TABLE public.usr_info
ADD COLUMN IF NOT EXISTS usr_tasy boolean;

UPDATE public.usr_info
SET usr_tasy = FALSE
WHERE usr_tasy IS NULL;

ALTER TABLE public.usr_info
ALTER COLUMN usr_tasy SET DEFAULT FALSE;

ALTER TABLE public.usr_info
ALTER COLUMN usr_tasy SET NOT NULL;
