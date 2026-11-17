-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : PostgreSQL 9.6+ (on-premises, Amazon RDS / Aurora,
--                    Azure Database for PostgreSQL, Google Cloud SQL / AlloyDB)
--                    and Greenplum 6+ / Tanzu Greenplum
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads pg_catalog and statistics views only. No business data
--                is read. Nothing is created or changed. Run it once per
--                database in scope (PostgreSQL catalogs are per database).
-- Permissions  : Any login that can connect; pg_read_all_stats (or
--                pg_monitor) gives the workload numbers.
-- How to run   : psql -h HOST -U USER -d DATABASE -X -A -t -F ',' \
--                     -f fabric_discovery_postgres.sql -o fabric_discovery_postgres.csv
--                Each statement stands alone: if one fails on an older
--                version, psql prints the error and carries on.
-- Output       : fabric_discovery_postgres.csv -> import it in the accelerator.
-- =============================================================================
SELECT 'platform', 'platform', CASE WHEN version() ILIKE '%greenplum%' THEN 'greenplum' ELSE 'postgres' END;
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', replace(split_part(version(), ' on ', 1), ',', ' ');
SELECT 'platform', 'database', current_database();

-- size
SELECT 'size', 'total_size_gb', round(sum(pg_database_size(datname)) / 1024.0 ^ 3, 2) FROM pg_database WHERE datname NOT IN ('template0', 'template1');
SELECT 'size', 'current_db_size_gb', round(pg_database_size(current_database()) / 1024.0 ^ 3, 2);
SELECT 'size', 'largest_table_gb', round(max(pg_total_relation_size(c.oid)) / 1024.0 ^ 3, 2)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%';

-- inventory (current database)
SELECT 'inventory', 'database_count', count(*) FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres';
SELECT 'inventory', 'schema_count', count(*) FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND nspname NOT LIKE 'pg\_%';
SELECT 'inventory', 'table_count', count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND n.nspname NOT LIKE 'pg\_%';
SELECT 'inventory', 'view_count', count(*) FROM pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit');
SELECT 'inventory', 'mview_count', count(*) FROM pg_class WHERE relkind = 'm';
SELECT 'inventory', 'partitioned_table_count', count(*) FROM pg_class WHERE relkind = 'p';
SELECT 'inventory', 'foreign_table_count', count(*) FROM pg_class WHERE relkind = 'f';
SELECT 'inventory', 'inherited_table_count', count(DISTINCT inhparent) FROM pg_inherits;
SELECT 'inventory', 'sequence_count', count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname NOT IN ('pg_catalog', 'information_schema');
SELECT 'inventory', 'trigger_count', count(*) FROM pg_trigger WHERE NOT tgisinternal;
-- PostgreSQL 11+: procedures vs functions (fails harmlessly on older versions)
SELECT 'inventory', 'proc_count', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prokind = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit');
SELECT 'inventory', 'function_count', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND n.nspname NOT LIKE 'pg\_%'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
SELECT 'code', 'language_' || l.lanname, count(*) FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND n.nspname NOT LIKE 'pg\_%'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
 GROUP BY l.lanname;
SELECT 'code', 'code_lines', coalesce(sum(length(p.prosrc) - length(replace(p.prosrc, chr(10), '')) + 1), 0)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND n.nspname NOT LIKE 'pg\_%'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
SELECT 'code', 'dynamic_sql_objects', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND p.prosrc ILIKE '%EXECUTE %';
SELECT 'code', 'recursive_views', count(*) FROM pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND definition ILIKE '%WITH RECURSIVE%';
SELECT 'inventory', 'extension_' || extname, extversion FROM pg_extension WHERE extname <> 'plpgsql';
SELECT 'inventory', 'fdw_server_count', count(*) FROM pg_foreign_server;

-- types
SELECT 'types', 'json_columns', count(*) FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND data_type IN ('json', 'jsonb');
SELECT 'types', 'array_columns', count(*) FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND data_type = 'ARRAY';
SELECT 'types', 'user_defined_columns', count(*) FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND data_type = 'USER-DEFINED';
SELECT 'types', 'tz_columns', count(*) FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND data_type IN ('timestamp with time zone', 'time with time zone');
SELECT 'types', 'interval_columns', count(*) FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND data_type IN ('interval', 'uuid', 'inet', 'cidr', 'bytea');

-- security
SELECT 'security', 'rls_policy_count', count(*) FROM pg_policy;
SELECT 'workload', 'user_count', count(*) FROM pg_roles WHERE rolcanlogin;

-- workload (since the statistics were last reset)
SELECT 'workload', 'daily_queries', round(sum(xact_commit + xact_rollback) / greatest(extract(epoch FROM now() - min(stats_reset)) / 86400, 1)) FROM pg_stat_database WHERE stats_reset IS NOT NULL;
SELECT 'workload', 'peak_connections', count(*) FROM pg_stat_activity;
SELECT 'cdc', 'wal_level', setting FROM pg_settings WHERE name = 'wal_level';
SELECT 'cdc', 'replication_slots', count(*) FROM pg_replication_slots;
SELECT 'client_app', replace(coalesce(nullif(application_name, ''), 'unknown'), ',', ' '), count(*) FROM pg_stat_activity GROUP BY 2 ORDER BY 3 DESC LIMIT 40;

-- Greenplum only (errors elsewhere are expected and harmless)
SELECT 'platform', 'segment_count', count(*) FROM gp_segment_configuration WHERE role = 'p' AND content >= 0;
SELECT 'inventory', 'ao_table_count', count(*) FROM pg_appendonly;
SELECT 'inventory', 'external_table_count', count(*) FROM pg_exttable;

-- largest tables
SELECT 'table_top', replace(n.nspname || '.' || c.relname, ',', ' '), round(pg_total_relation_size(c.oid) / 1024.0 ^ 3, 3) || '|' || c.reltuples::bigint
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'gp_toolkit') AND n.nspname NOT LIKE 'pg\_%'
 ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 25;
