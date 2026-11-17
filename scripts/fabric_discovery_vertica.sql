-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Vertica 9+ (Enterprise and Eon mode, OpenText Vertica)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads V_CATALOG and V_MONITOR system tables only. No business
--                data is read. Nothing is created or changed.
-- Permissions  : dbadmin, or a user with the SYSMONITOR role.
-- How to run   : vsql -h HOST -U USER -d DATABASE -A -t -F ',' \
--                     -f fabric_discovery_vertica.sql -o fabric_discovery_vertica.csv
-- Output       : fabric_discovery_vertica.csv -> import it in the accelerator.
-- =============================================================================
SELECT 'platform', 'platform', 'vertica';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', replace(version(), ',', ' ');

SELECT 'size', 'total_size_gb', round(sum(used_bytes) / 1024 ^ 3, 2) FROM v_monitor.projection_storage;
SELECT 'size', 'largest_table_gb', round(max(b) / 1024 ^ 3, 2) FROM (SELECT anchor_table_schema, anchor_table_name, sum(used_bytes) b FROM v_monitor.projection_storage GROUP BY 1, 2) t;
SELECT 'inventory', 'schema_count', count(*) FROM v_catalog.schemata WHERE NOT is_system_schema;
SELECT 'inventory', 'table_count', count(*) FROM v_catalog.tables WHERE NOT is_system_table;
SELECT 'inventory', 'external_table_count', count(*) FROM v_catalog.tables WHERE NOT is_system_table AND table_definition <> '';
SELECT 'inventory', 'flex_table_count', count(*) FROM v_catalog.tables WHERE NOT is_system_table AND is_flextable;
SELECT 'inventory', 'view_count', count(*) FROM v_catalog.views WHERE NOT is_system_view;
SELECT 'inventory', 'projection_count', count(*) FROM v_catalog.projections;
SELECT 'inventory', 'proc_count', count(*) FROM v_catalog.user_procedures;
SELECT 'inventory', 'function_count', count(*) FROM v_catalog.user_functions;
SELECT 'code', 'udx_count', count(*) FROM v_catalog.user_functions WHERE procedure_type ILIKE '%User Defined%' AND function_definition NOT ILIKE 'RETURN%';
SELECT 'inventory', 'sequence_count', count(*) FROM v_catalog.sequences;
SELECT 'code', 'ml_model_count', count(*) FROM v_catalog.models;
SELECT 'types', 'complex_columns', count(*) FROM v_catalog.columns WHERE data_type ILIKE 'array%' OR data_type ILIKE 'row%' OR data_type ILIKE 'long%';
SELECT 'types', 'tz_columns', count(*) FROM v_catalog.columns WHERE data_type ILIKE 'timestamptz%' OR data_type ILIKE 'timetz%';
SELECT 'types', 'spatial_columns', count(*) FROM v_catalog.columns WHERE data_type ILIKE 'geometry%' OR data_type ILIKE 'geography%';
SELECT 'security', 'rls_policy_count', count(*) FROM v_catalog.access_policy WHERE policy_type = 'Row Policy';
SELECT 'security', 'masked_column_count', count(*) FROM v_catalog.access_policy WHERE policy_type = 'Column Policy';
SELECT 'workload', 'user_count', count(*) FROM v_catalog.users;
SELECT 'workload', 'queries_30d', count(*) FROM v_monitor.query_requests WHERE start_timestamp > now() - interval '30 days';
SELECT 'workload', 'dbql_days', greatest(datediff('day', min(start_timestamp), now()), 1) FROM v_monitor.query_requests;
SELECT 'workload', 'peak_hour_queries', max(c) FROM (SELECT date_trunc('hour', start_timestamp) h, count(*) c FROM v_monitor.query_requests GROUP BY 1) t;
SELECT 'client_app', replace(coalesce(nullif(client_label, ''), client_type, 'unknown'), ',', ' '), count(*) FROM v_monitor.sessions GROUP BY 2 ORDER BY 3 DESC LIMIT 40;
SELECT 'table_top', replace(anchor_table_schema || '.' || anchor_table_name, ',', ' '), round(sum(used_bytes) / 1024 ^ 3, 3)::varchar || '|' || sum(row_count)::varchar FROM v_monitor.projection_storage GROUP BY 2 ORDER BY sum(used_bytes) DESC LIMIT 25;
