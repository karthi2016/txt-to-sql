create table "timestamps" (
 "ts1" timestamp,
 "fecha" date,
 primary key ("ts1")
);

insert into "timestamps" ("ts1", "fecha") values
 ('2016-11-21 10:00:01', '2/2/1969'),
 ('2010-01-21 00:10:00.009', '20/3/1969'),
 ('1969-05-06 00:10:00 -3:00', null);