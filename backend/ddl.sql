create sequence services_tags_tag_id_seq;

create table services_category (
   tag_id    int4 default nextval('services_tags_tag_id_seq'::regclass) not null primary key,
   tag_name  text not null
);

insert into services_category (tag_name) values
   ('CPOE'),
   ('ADEP'),
   ('Farmacia');

create table services_info (
   srv_id       serial primary key,
   srv_image    bytea,
   srv_name     text not null,
   srv_ip       text not null,
   srv_category int4 not null default 1 references services_category(tag_id),
   srv_desc     text
);

create table usr_info (
   usr_id       serial primary key,
   usr_login    text not null unique,
   usr_password text not null,
   usr_access   text,
   usr_admin    boolean default false,
   created_at   timestamptz default current_timestamp
);

create table usr_favorite_services (
   usr_id     int4 not null references usr_info(usr_id) on delete cascade,
   srv_id     int4 not null references services_info(srv_id) on delete cascade,
   created_at timestamptz not null default current_timestamp,
   primary key (usr_id, srv_id)
);
