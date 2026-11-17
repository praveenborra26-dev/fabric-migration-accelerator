-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : IBM Netezza / PureData for Analytics / Netezza Performance
--                    Server (NPS 7.2+, Cloud Pak for Data)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads _V_ system views only. No business data is read.
--                Nothing is created or changed.
-- Permissions  : ADMIN, or a user with LIST and SELECT on the system views
--                (otherwise counts cover only objects that user can see).
-- How to run   : nzsql -host HOST -d SYSTEM -u USER -A -t -F ',' \
--                      -f fabric_discovery_netezza.sql -o fabric_discovery_netezza.csv
--                Each statement stands alone; failures are skipped.
-- Output       : fabric_discovery_netezza.csv -> import it in the accelerator.
-- =============================================================================
SELECT 'platform', 'platform', 'netezza';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', replace(version(), ',', ' ');

SELECT 'size', 'total_size_gb', round(sum(used_bytes) / 1024.0 / 1024 / 1024, 2) FROM _v_table_storage_stat;
SELECT 'size', 'largest_table_gb', round(max(used_bytes) / 1024.0 / 1024 / 1024, 2) FROM _v_table_storage_stat;
SELECT 'inventory', 'database_count', count(*) FROM _v_database WHERE database NOT IN ('SYSTEM');
SELECT 'inventory', 'schema_count', count(*) FROM _v_schema WHERE schema NOT IN ('DEFINITION_SCHEMA', 'INFORMATION_SCHEMA');
SELECT 'inventory', 'table_count', count(*) FROM _v_table WHERE objtype = 'TABLE';
SELECT 'inventory', 'view_count', count(*) FROM _v_view WHERE objtype = 'VIEW';
SELECT 'inventory', 'mview_count', count(*) FROM _v_view WHERE objtype = 'MATERIALIZED VIEW';
SELECT 'inventory', 'proc_count', count(*) FROM _v_procedure;
SELECT 'inventory', 'function_count', count(*) FROM _v_function WHERE builtin = 'f';
SELECT 'inventory', 'sequence_count', count(*) FROM _v_sequence;
SELECT 'inventory', 'synonym_count', count(*) FROM _v_synonym;
SELECT 'inventory', 'external_table_count', count(*) FROM _v_external;
SELECT 'code', 'code_lines', coalesce(sum(length(proceduresource) - length(replace(proceduresource, chr(10), '')) + 1), 0) FROM _v_procedure;
SELECT 'code', 'udx_count', count(*) FROM _v_function WHERE builtin = 'f' AND language IN ('CPP', 'JAVA', 'PYTHON', 'LUA', 'R');
SELECT 'types', 'nchar_columns', count(*) FROM _v_relation_column WHERE format_type LIKE 'NATIONAL%';
SELECT 'types', 'interval_columns', count(*) FROM _v_relation_column WHERE format_type LIKE 'INTERVAL%' OR format_type LIKE 'TIME WITH%';
SELECT 'workload', 'user_count', count(*) FROM _v_user;
SELECT 'workload', 'queries_30d', count(*) FROM _v_qryhist WHERE qh_tstart > now() - interval '30 days';
SELECT 'workload', 'dbql_days', '30';
SELECT 'client_app', replace(coalesce(client_os_username, 'unknown'), ',', ' '), count(*) FROM _v_session GROUP BY 2 ORDER BY 3 DESC LIMIT 40;
SELECT 'table_top', replace(database || '.' || schema || '.' || tablename, ',', ' '), round(used_bytes / 1024.0 / 1024 / 1024, 3)::varchar || '|' FROM _v_table_storage_stat ORDER BY used_bytes DESC LIMIT 25;
