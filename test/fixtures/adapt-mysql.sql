create table `adapt-mysql` (
 `texts` varchar,
 `integers` integer
);

insert into `adapt-mysql` (`texts`, `integers`) values
 ('dos palabras', 1),
 ('una comilla''simple', 2),
 ('dos comillas"dobles"', 3),
 ('varios `, \ y /', 4),
 (null, 5),
 ('% pct', null),
 (null, null);