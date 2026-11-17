-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Amazon Redshift (provisioned RA3/DC2 and Serverless)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads system tables and views (SVV_*, SYS_*, PG_*) only.
--                No business data is read. Nothing is created or changed.
-- Permissions  : A superuser, or a user granted the sys:monitor role plus
--                ACCESS SYSTEM TABLE (otherwise some counts cover only the
--                objects that user can see).
-- How to run   : psql "host=CLUSTER.region.redshift.amazonaws.com port=5439 dbname=DB user=USER sslmode=require" \
--                     -X -A -t -F ',' -f fabric_discovery_redshift.sql -o fabric_discovery_redshift.csv
--                Each statement stands alone: if one fails (for example a
--                provisioned-only table on Serverless), the rest still run.
--                Query editor v2 also works: run all, export each result.
-- Output       : fabric_discovery_redshift.csv -> import it in the accelerator.
-- =============================================================================
SELECT 'platform', 'platform', 'redshift';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', replace(version(), ',', ' ');

-- size and tables (SVV_TABLE_INFO: size is in 1 MB blocks)
SELECT 'size', 'total_size_gb', round(sum(size) / 1024.0, 2) FROM svv_table_info;
SELECT 'size', 'largest_table_gb', round(max(size) / 1024.0, 2) FROM svv_table_info;
SELECT 'inventory', 'table_count', count(*) FROM svv_table_info;
SELECT 'inventory', 'database_count', count(DISTINCT "database") FROM svv_table_info;
SELECT 'inventory', 'schema_count', count(DISTINCT "schema") FROM svv_table_info;
SELECT 'inventory', 'distkey_table_count', count(*) FROM svv_table_info WHERE diststyle LIKE 'KEY%';
SELECT 'table_top', replace("schema" || '.' || "table", ',', ' '), round(size / 1024.0, 3)::varchar || '|' || tbl_rows::varchar FROM svv_table_info ORDER BY size DESC LIMIT 25;

-- catalog objects
SELECT 'inventory', 'view_count', count(*) FROM pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_internal');
SELECT 'inventory', 'mview_count', count(*) FROM svv_mv_info;
SELECT 'inventory', 'proc_count', count(*) FROM pg_proc_info p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prokind = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema');
SELECT 'inventory', 'function_count', count(*) FROM pg_proc_info p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prokind = 'f' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.proowner > 1;
SELECT 'code', 'python_udf_count', count(*) FROM pg_proc_info p JOIN pg_language l ON l.oid = p.prolang WHERE l.lanname = 'plpythonu';
SELECT 'code', 'lambda_udf_count', count(*) FROM pg_proc_info p JOIN pg_language l ON l.oid = p.prolang WHERE l.lanname = 'exfunc';
SELECT 'code', 'code_lines', coalesce(sum(regexp_count(p.prosrc, '\n') + 1), 0) FROM pg_proc_info p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.proowner > 1;
SELECT 'inventory', 'external_schema_count', count(*) FROM svv_external_schemas;
SELECT 'inventory', 'external_table_count', count(*) FROM svv_external_tables;
SELECT 'inventory', 'datashare_count', count(*) FROM svv_datashares;
SELECT 'inventory', 'federated_schema_count', count(*) FROM svv_external_schemas WHERE eskind IN (3, 4);

-- types
SELECT 'types', 'super_columns', count(*) FROM svv_columns WHERE data_type = 'super' AND table_schema NOT IN ('pg_catalog', 'information_schema');
SELECT 'types', 'spatial_columns', count(*) FROM svv_columns WHERE data_type IN ('geometry', 'geography') AND table_schema NOT IN ('pg_catalog', 'information_schema');
SELECT 'types', 'tz_columns', count(*) FROM svv_columns WHERE data_type IN ('timestamp with time zone', 'time with time zone') AND table_schema NOT IN ('pg_catalog', 'information_schema');
SELECT 'types', 'varbyte_hll_columns', count(*) FROM svv_columns WHERE data_type IN ('binary varying', 'hllsketch') AND table_schema NOT IN ('pg_catalog', 'information_schema');

-- security
SELECT 'security', 'rls_policy_count', count(*) FROM svv_rls_policy;
SELECT 'security', 'masked_column_count', count(*) FROM svv_attached_masking_policy;

-- workload (SYS_QUERY_HISTORY keeps about 7 days)
SELECT 'workload', 'queries_30d', count(*) FROM sys_query_history WHERE query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CTAS', 'COPY', 'UNLOAD', 'MERGE');
SELECT 'workload', 'dbql_days', greatest(datediff(day, min(start_time), getdate()), 1) FROM sys_query_history;
SELECT 'workload', 'peak_hour_queries', max(c) FROM (SELECT date_trunc('hour', start_time) h, count(*) c FROM sys_query_history GROUP BY 1);
SELECT 'workload', 'user_count', count(*) FROM pg_user;
SELECT 'workload', 'wlm_queue_count', count(DISTINCT service_class) FROM stv_wlm_service_class_config WHERE service_class > 5;
SELECT 'etl', 'scheduler_jobs', count(DISTINCT query_text) FROM sys_query_history WHERE query_type IN ('COPY', 'UNLOAD');
SELECT 'client_app', replace(coalesce(nullif(trim(application_name), ''), 'unknown'), ',', ' '), count(*) FROM stl_connection_log WHERE event = 'authenticated' GROUP BY 2 ORDER BY 3 DESC LIMIT 40;
