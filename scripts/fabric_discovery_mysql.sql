-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : MySQL 5.7+ / 8.x / 9.x and MariaDB 10.3+ (on-premises,
--                    Amazon RDS / Aurora MySQL, Azure Database for MySQL,
--                    Google Cloud SQL)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads information_schema, performance_schema and status
--                variables only. No business data is read. Nothing is changed.
-- Permissions  : PROCESS and SELECT on information_schema / performance_schema
--                (SHOW VIEW for view text).
-- How to run   : mysql -h HOST -u USER -p --batch --skip-column-names --force \
--                      < fabric_discovery_mysql.sql > fabric_discovery_mysql.tsv
--                --force keeps going if a statement fails on your version.
-- Output       : fabric_discovery_mysql.tsv (tab separated) -> import it.
-- =============================================================================
SELECT 'platform', 'platform', 'mysql';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', REPLACE(VERSION(), ',', ' ');
SELECT 'platform', 'flavor', IF(VERSION() LIKE '%MariaDB%', 'MariaDB', 'MySQL');

SELECT 'size', 'total_size_gb', ROUND(SUM(data_length + index_length) / POW(1024, 3), 2) FROM information_schema.tables WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'size', 'largest_table_gb', ROUND(MAX(data_length + index_length) / POW(1024, 3), 2) FROM information_schema.tables WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'inventory', 'database_count', COUNT(*) FROM information_schema.schemata WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'inventory', 'table_count', COUNT(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'inventory', 'view_count', COUNT(*) FROM information_schema.views WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'inventory', 'proc_count', COUNT(*) FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND routine_schema NOT IN ('mysql', 'sys');
SELECT 'inventory', 'function_count', COUNT(*) FROM information_schema.routines WHERE routine_type = 'FUNCTION' AND routine_schema NOT IN ('mysql', 'sys');
SELECT 'inventory', 'trigger_count', COUNT(*) FROM information_schema.triggers WHERE trigger_schema NOT IN ('mysql', 'sys');
SELECT 'inventory', 'partitioned_table_count', COUNT(DISTINCT table_schema, table_name) FROM information_schema.partitions WHERE partition_name IS NOT NULL;
SELECT 'inventory', 'fulltext_index_count', COUNT(DISTINCT table_schema, table_name, index_name) FROM information_schema.statistics WHERE index_type = 'FULLTEXT';
SELECT 'inventory', 'non_innodb_table_count', COUNT(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND engine NOT IN ('InnoDB') AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'etl', 'scheduler_jobs', COUNT(*) FROM information_schema.events;
SELECT 'code', 'code_lines', COALESCE(SUM(LENGTH(routine_definition) - LENGTH(REPLACE(routine_definition, CHAR(10), '')) + 1), 0) FROM information_schema.routines WHERE routine_schema NOT IN ('mysql', 'sys');
SELECT 'code', 'cursor_objects', COUNT(*) FROM information_schema.routines WHERE routine_definition LIKE '%CURSOR%' AND routine_schema NOT IN ('mysql', 'sys');
SELECT 'types', 'json_columns', COUNT(*) FROM information_schema.columns WHERE data_type = 'json' AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'types', 'enum_set_columns', COUNT(*) FROM information_schema.columns WHERE data_type IN ('enum', 'set') AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'types', 'unsigned_columns', COUNT(*) FROM information_schema.columns WHERE column_type LIKE '%unsigned%' AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'types', 'spatial_columns', COUNT(*) FROM information_schema.columns WHERE data_type IN ('geometry', 'point', 'linestring', 'polygon', 'multipoint', 'multilinestring', 'multipolygon', 'geometrycollection') AND table_schema NOT IN ('mysql', 'sys');
SELECT 'types', 'year_bit_columns', COUNT(*) FROM information_schema.columns WHERE data_type IN ('year', 'bit') AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys');
SELECT 'workload', 'user_count', COUNT(*) FROM mysql.user WHERE user NOT IN ('mysql.sys', 'mysql.session', 'mysql.infoschema', 'rdsadmin', '');
SELECT 'workload', 'daily_queries', ROUND(q.v / GREATEST(u.v / 86400, 1)) FROM
  (SELECT variable_value v FROM performance_schema.global_status WHERE variable_name = 'Questions') q,
  (SELECT variable_value v FROM performance_schema.global_status WHERE variable_name = 'Uptime') u;
SELECT 'workload', 'peak_connections', variable_value FROM performance_schema.global_status WHERE variable_name = 'Max_used_connections';
SELECT 'cdc', 'binlog_format', @@global.binlog_format;
SELECT 'cdc', 'log_bin', @@global.log_bin;
SELECT 'client_app', REPLACE(COALESCE(attr_value, 'unknown'), ',', ' '), COUNT(*) FROM performance_schema.session_connect_attrs WHERE attr_name = 'program_name' GROUP BY 2 ORDER BY 3 DESC LIMIT 40;
SELECT 'table_top', REPLACE(CONCAT(table_schema, '.', table_name), ',', ' '), CONCAT(ROUND((data_length + index_length) / POW(1024, 3), 3), '|', table_rows)
  FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
 ORDER BY data_length + index_length DESC LIMIT 25;
