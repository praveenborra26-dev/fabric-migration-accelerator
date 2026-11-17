-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Azure Synapse Analytics dedicated SQL pool (formerly
--                    Azure SQL Data Warehouse)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads sys.* catalog views and DMVs only. No business data is
--                read. Nothing is created or changed.
-- Permissions  : VIEW DATABASE STATE and VIEW DEFINITION on the pool.
-- How to run   : sqlcmd -S WORKSPACE.sql.azuresynapse.net -d POOL -G -s "," -W -h -1 \
--                       -i fabric_discovery_synapse.sql -o fabric_discovery_synapse.csv
--                SSMS also works: run all, then save each result as CSV.
-- Output       : fabric_discovery_synapse.csv -> import it in the accelerator.
-- =============================================================================
SET NOCOUNT ON;
SELECT 'platform', 'platform', 'synapse';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', REPLACE(CAST(SERVERPROPERTY('ProductVersion') AS varchar(50)), ',', ' ');
SELECT 'platform', 'service_objective', CAST(DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective') AS varchar(50));

SELECT 'size', 'total_size_gb', CAST(ROUND(SUM(reserved_page_count) * 8.0 / 1024 / 1024, 2) AS varchar(30)) FROM sys.dm_pdw_nodes_db_partition_stats;
SELECT 'inventory', 'schema_count', CAST(COUNT(*) AS varchar(20)) FROM sys.schemas WHERE schema_id BETWEEN 5 AND 16383;
SELECT 'inventory', 'table_count', CAST(COUNT(*) AS varchar(20)) FROM sys.tables WHERE is_external = 0;
SELECT 'inventory', 'external_table_count', CAST(COUNT(*) AS varchar(20)) FROM sys.external_tables;
SELECT 'inventory', 'view_count', CAST(COUNT(*) AS varchar(20)) FROM sys.views;
SELECT 'inventory', 'mview_count', CAST(COUNT(*) AS varchar(20)) FROM sys.indexes WHERE type = 2 AND object_id IN (SELECT object_id FROM sys.views);
SELECT 'inventory', 'proc_count', CAST(COUNT(*) AS varchar(20)) FROM sys.procedures;
SELECT 'inventory', 'function_count', CAST(COUNT(*) AS varchar(20)) FROM sys.objects WHERE type IN ('FN', 'IF', 'TF');
SELECT 'inventory', 'replicated_table_count', CAST(COUNT(*) AS varchar(20)) FROM sys.pdw_table_distribution_properties WHERE distribution_policy_desc = 'REPLICATE';
SELECT 'code', 'code_lines', CAST(SUM(LEN(definition) - LEN(REPLACE(definition, CHAR(10), '')) + 1) AS varchar(30)) FROM sys.sql_modules;
SELECT 'code', 'dynamic_sql_objects', CAST(COUNT(*) AS varchar(20)) FROM sys.sql_modules WHERE definition LIKE '%sp_executesql%' OR definition LIKE '%EXEC(%' OR definition LIKE '%EXECUTE(%';
SELECT 'code', 'ctas_objects', CAST(COUNT(*) AS varchar(20)) FROM sys.sql_modules WHERE definition LIKE '%CREATE TABLE%AS SELECT%';
SELECT 'types', 'col_nvarchar', CAST(COUNT(*) AS varchar(20)) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE t.name IN ('nvarchar', 'nchar');
SELECT 'types', 'col_datetime', CAST(COUNT(*) AS varchar(20)) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE t.name IN ('datetime', 'smalldatetime', 'money', 'smallmoney', 'tinyint', 'datetimeoffset');
SELECT 'security', 'rls_policy_count', CAST(COUNT(*) AS varchar(20)) FROM sys.security_policies;
SELECT 'security', 'masked_column_count', CAST(COUNT(*) AS varchar(20)) FROM sys.masked_columns;
SELECT 'workload', 'workload_group_count', CAST(COUNT(*) AS varchar(20)) FROM sys.workload_management_workload_groups WHERE group_id > 12;
SELECT 'workload', 'queries_30d', CAST(COUNT(*) AS varchar(20)) FROM sys.dm_pdw_exec_requests WHERE session_id <> SESSION_ID();
SELECT 'workload', 'dbql_days', CAST(CASE WHEN DATEDIFF(day, MIN(submit_time), GETDATE()) < 1 THEN 1 ELSE DATEDIFF(day, MIN(submit_time), GETDATE()) END AS varchar(20)) FROM sys.dm_pdw_exec_requests;
SELECT 'workload', 'peak_connections', CAST(COUNT(*) AS varchar(20)) FROM sys.dm_pdw_exec_sessions WHERE status <> 'Closed';
SELECT 'client_app', REPLACE(ISNULL(app_name, 'unknown'), ',', ' '), CAST(COUNT(*) AS varchar(20)) FROM sys.dm_pdw_exec_sessions GROUP BY app_name;
SELECT TOP 25 'table_top', REPLACE(s.name + '.' + t.name, ',', ' '), CAST(CAST(ROUND(SUM(ps.reserved_page_count) * 8.0 / 1024 / 1024, 3) AS decimal(18, 3)) AS varchar(30)) + '|' + CAST(SUM(ps.row_count) AS varchar(30))
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  JOIN sys.pdw_table_mappings m ON m.object_id = t.object_id
  JOIN sys.pdw_nodes_tables nt ON nt.name = m.physical_name
  JOIN sys.dm_pdw_nodes_db_partition_stats ps ON ps.object_id = nt.object_id AND ps.pdw_node_id = nt.pdw_node_id AND ps.distribution_id = nt.distribution_id AND ps.index_id <= 1
 GROUP BY s.name, t.name ORDER BY SUM(ps.reserved_page_count) DESC;
