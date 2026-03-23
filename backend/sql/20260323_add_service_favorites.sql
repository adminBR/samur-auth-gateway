CREATE TABLE IF NOT EXISTS public.usr_favorite_services (
    usr_id int4 NOT NULL,
    srv_id int4 NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT usr_favorite_services_pkey PRIMARY KEY (usr_id, srv_id),
    CONSTRAINT usr_favorite_services_usr_id_fkey
        FOREIGN KEY (usr_id)
        REFERENCES public.usr_info(usr_id)
        ON DELETE CASCADE,
    CONSTRAINT usr_favorite_services_srv_id_fkey
        FOREIGN KEY (srv_id)
        REFERENCES public.services_info(srv_id)
        ON DELETE CASCADE
);
