

DROP SCHEMA IF EXISTS ee_orm_nestedset_test CASCADE;
CREATE SCHEMA ee_orm_nestedset_test;

CREATE TABLE ee_orm_nestedset_test.tree (
      id                serial NOT NULL
    , name              varchar(100)
    , "group"           integer
    , "left"            integer NOT NULL
    , "right"           integer NOT NULL
    , CONSTRAINT "pk_event" PRIMARY KEY (id)
);
