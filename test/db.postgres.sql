

DROP SCHEMA IF EXISTS related_nestedset_test CASCADE;
CREATE SCHEMA related_nestedset_test;

CREATE TABLE related_nestedset_test.tree (
      id                serial NOT NULL
    , name              varchar(100)
    , "group"           integer
    , "left"            integer NOT NULL
    , "right"           integer NOT NULL
    , CONSTRAINT "pk_event" PRIMARY KEY (id)
);
