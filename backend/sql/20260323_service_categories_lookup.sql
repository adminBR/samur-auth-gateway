CREATE SEQUENCE IF NOT EXISTS services_tags_tag_id_seq;

CREATE TABLE IF NOT EXISTS public.services_category (
    tag_id int4 DEFAULT nextval('services_tags_tag_id_seq'::regclass) NOT NULL,
    tag_name text NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'services_category_pkey'
    ) THEN
        ALTER TABLE public.services_category
            ADD CONSTRAINT services_category_pkey PRIMARY KEY (tag_id);
    END IF;
END $$;

INSERT INTO public.services_category (tag_name)
SELECT seed.tag_name
FROM (
    VALUES
        ('CPOE'),
        ('ADEP'),
        ('Farmacia')
) AS seed(tag_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.services_category sc
    WHERE lower(sc.tag_name) = lower(seed.tag_name)
);

DO $$
DECLARE
    current_type text;
BEGIN
    SELECT data_type
    INTO current_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services_info'
      AND column_name = 'srv_category';

    IF current_type IS NULL THEN
        ALTER TABLE public.services_info
            ADD COLUMN srv_category int4;
    ELSIF current_type <> 'integer' THEN
        ALTER TABLE public.services_info
            ADD COLUMN IF NOT EXISTS srv_category_id int4;

        EXECUTE '
            UPDATE public.services_info si
            SET srv_category_id = sc.tag_id
            FROM public.services_category sc
            WHERE lower(trim(si.srv_category)) = lower(trim(sc.tag_name))
        ';

        EXECUTE '
            UPDATE public.services_info
            SET srv_category_id = CAST(trim(srv_category) AS int4)
            WHERE srv_category_id IS NULL
              AND trim(srv_category) ~ ''^[0-9]+$''
        ';

        EXECUTE '
            UPDATE public.services_info
            SET srv_category_id = (
                SELECT tag_id
                FROM public.services_category
                ORDER BY tag_id
                LIMIT 1
            )
            WHERE srv_category_id IS NULL
        ';

        ALTER TABLE public.services_info
            DROP COLUMN srv_category;

        ALTER TABLE public.services_info
            RENAME COLUMN srv_category_id TO srv_category;
    END IF;
END $$;

UPDATE public.services_info
SET srv_category = (
    SELECT tag_id
    FROM public.services_category
    ORDER BY tag_id
    LIMIT 1
)
WHERE srv_category IS NULL
   OR NOT EXISTS (
        SELECT 1
        FROM public.services_category sc
        WHERE sc.tag_id = public.services_info.srv_category
   );

ALTER TABLE public.services_info
    ALTER COLUMN srv_category SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'services_info_srv_category_fkey'
    ) THEN
        ALTER TABLE public.services_info
            ADD CONSTRAINT services_info_srv_category_fkey
            FOREIGN KEY (srv_category)
            REFERENCES public.services_category(tag_id);
    END IF;
END $$;
