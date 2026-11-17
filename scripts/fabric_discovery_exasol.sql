-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Exasol 7+ (on-premises, cloud, SaaS)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads EXA_* system tables only. No business data is read.
-- Permissions  : SELECT ANY DICTIONARY (for the EXA_DBA_* views).
-- How to run   : Open in DBeaver (or another SQL client), run as a script and
--                export the results as CSV without headers. Statements your
--                version rejects can be skipped.
-- Output       : import the CSV file(s) in the accelerator.
-- =============================================================================
SELECT 'platform' AS s, 'platform' AS m, 'exasol' AS v;
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', PARAM_VALUE FROM EXA_METADATA WHERE PARAM_NAME = 'databaseProductVersion';
SELECT 'size', 'total_size_gb', TO_CHAR(ROUND(SUM(RAW_OBJECT_SIZE) / POWER(1024, 3), 2)) FROM EXA_DBA_OBJECT_SIZES WHERE OBJECT_TYPE = 'TABLE';
SELECT 'size', 'largest_table_gb', TO_CHAR(ROUND(MAX(RAW_OBJECT_SIZE) / POWER(1024, 3), 2)) FROM EXA_DBA_OBJECT_SIZES WHERE OBJECT_TYPE = 'TABLE';
SELECT 'inventory', 'schema_count', TO_CHAR(COUNT(*)) FROM EXA_SCHEMAS;
SELECT 'inventory', 'virtual_schema_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_VIRTUAL_SCHEMAS;
SELECT 'inventory', 'table_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_TABLES;
SELECT 'inventory', 'view_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_VIEWS;
SELECT 'inventory', 'function_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_FUNCTIONS;
SELECT 'inventory', 'proc_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_SCRIPTS WHERE SCRIPT_TYPE = 'PROCEDURE';
SELECT 'code', 'udf_script_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_SCRIPTS WHERE SCRIPT_TYPE IN ('UDF', 'ADAPTER');
SELECT 'code', 'code_lines', TO_CHAR(SUM(LENGTH(SCRIPT_TEXT) - LENGTH(REPLACE(SCRIPT_TEXT, CHR(10), '')) + 1)) FROM EXA_DBA_SCRIPTS;
SELECT 'inventory', 'connection_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_CONNECTIONS;
SELECT 'types', 'geometry_columns', TO_CHAR(COUNT(*)) FROM EXA_DBA_COLUMNS WHERE COLUMN_TYPE LIKE 'GEOMETRY%';
SELECT 'types', 'tz_columns', TO_CHAR(COUNT(*)) FROM EXA_DBA_COLUMNS WHERE COLUMN_TYPE LIKE '%LOCAL TIME ZONE%' OR COLUMN_TYPE LIKE 'INTERVAL%' OR COLUMN_TYPE LIKE 'HASHTYPE%';
SELECT 'workload', 'user_count', TO_CHAR(COUNT(*)) FROM EXA_DBA_USERS;
SELECT 'workload', 'daily_queries', TO_CHAR(ROUND(AVG(c))) FROM (SELECT TRUNC(START_TIME) d, COUNT(*) c FROM EXA_DBA_AUDIT_SQL GROUP BY TRUNC(START_TIME));
SELECT 'workload', 'peak_connections', TO_CHAR(MAX(USERS)) FROM EXA_USAGE_DAILY;
SELECT 'client_app', REPLACE(CLIENT, ',', ' '), TO_CHAR(COUNT(*)) FROM EXA_DBA_SESSIONS GROUP BY CLIENT;
SELECT 'table_top', REPLACE(OBJECT_NAME, ',', ' '), TO_CHAR(ROUND(RAW_OBJECT_SIZE / POWER(1024, 3), 3)) || '|' FROM EXA_DBA_OBJECT_SIZES WHERE OBJECT_TYPE = 'TABLE' ORDER BY RAW_OBJECT_SIZE DESC LIMIT 25;
