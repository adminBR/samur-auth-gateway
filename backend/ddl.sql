create table services_info (
   srv_id    serial primary key,
   srv_image bytea,
   srv_name  text not null,
   srv_ip    text not null,
   srv_category text not null default 'cpoe',
   srv_desc  text
);

create table usr_info (
   usr_id       serial primary key,
   usr_login    text not null unique,
   usr_password text not null,
   usr_access   text,
   usr_admin    boolean default false,
   created_at   timestamptz default current_timestamp
);
