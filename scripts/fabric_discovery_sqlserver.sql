/* =============================================================================
   Fabric Migration Assessment Accelerator
   Discovery script : Microsoft SQL Server 2012+ / Azure SQL Managed Instance
   Script version   : 2026.11
   -----------------------------------------------------------------------------
   What it does : Reads catalog views and DMVs only. No business data is read and
                  nothing is written outside tempdb (#temp tables, dropped at end).
   Permissions  : VIEW SERVER STATE + VIEW ANY DEFINITION (a read-only sysadmin
                  login also works). Reads msdb, SSISDB and ReportServer if present.
   How to run   : SSMS or Azure Data Studio -> New Query on the instance -> Execute.
                  Save the single result grid as CSV (right-click the grid ->
                  Save Results As...). Import the CSV in the accelerator:
                  Automate -> Discovery scripts -> Import results.
   Runtime      : Usually under 2 minutes; grows with the number of objects.
   Privacy      : Set @include_object_names = 0 to omit the top-25 table names.
   ============================================================================= */
SET NOCOUNT ON;
DECLARE @include_object_names bit = 1;

IF OBJECT_ID('tempdb..#fab') IS NOT NULL DROP TABLE #fab;
IF OBJECT_ID('tempdb..#db')  IS NOT NULL DROP TABLE #db;
IF OBJECT_ID('tempdb..#top') IS NOT NULL DROP TABLE #top;
CREATE TABLE #fab (section varchar(40), metric varchar(256), value nvarchar(4000));
CREATE TABLE #db  (dbname sysname, metric varchar(128), value float);
CREATE TABLE #top (dbname sysname, schema_name sysname, table_name sysname, size_gb decimal(18,3), row_count bigint);

DECLARE @major int = CAST(PARSENAME(CONVERT(varchar(32), SERVERPROPERTY('ProductVersion')), 4) AS int);

/* ---- Platform ------------------------------------------------------------ */
INSERT #fab VALUES ('platform','platform','mssql'), ('platform','script_version','2026.11'), ('platform','product','Microsoft SQL Server');
INSERT #fab SELECT 'platform','version',        CONVERT(nvarchar(100), SERVERPROPERTY('ProductVersion'));
INSERT #fab SELECT 'platform','product_level',  CONVERT(nvarchar(100), SERVERPROPERTY('ProductLevel'));
INSERT #fab SELECT 'platform','edition',        CONVERT(nvarchar(200), SERVERPROPERTY('Edition'));
INSERT #fab SELECT 'platform','engine_edition', CONVERT(nvarchar(20),  SERVERPROPERTY('EngineEdition'));
INSERT #fab SELECT 'platform','collation',      CONVERT(nvarchar(200), SERVERPROPERTY('Collation'));
INSERT #fab SELECT 'platform','is_clustered',   CONVERT(nvarchar(10),  SERVERPROPERTY('IsClustered'));
INSERT #fab SELECT 'platform','is_hadr_enabled',CONVERT(nvarchar(10),  SERVERPROPERTY('IsHadrEnabled'));
BEGIN TRY
  INSERT #fab SELECT 'platform','cpu_count',   CONVERT(nvarchar(20), cpu_count) FROM sys.dm_os_sys_info;
  INSERT #fab SELECT 'platform','memory_gb',   CONVERT(nvarchar(30), CAST(physical_memory_kb / 1048576.0 AS decimal(18,1))) FROM sys.dm_os_sys_info;
  INSERT #fab SELECT 'platform','uptime_days', CONVERT(nvarchar(30), CAST(DATEDIFF(minute, sqlserver_start_time, GETDATE()) / 1440.0 AS decimal(18,1))) FROM sys.dm_os_sys_info;
END TRY BEGIN CATCH INSERT #fab VALUES ('error','os_info', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
INSERT #fab SELECT 'platform','min_compat_level', CONVERT(nvarchar(10), MIN(compatibility_level)) FROM sys.databases WHERE database_id > 4;

/* ---- Server-level inventory, workload, CDC, security ---------------------- */
INSERT #fab SELECT 'inventory','database_count', CONVERT(nvarchar(20), COUNT(*)) FROM sys.databases
  WHERE database_id > 4 AND state_desc = 'ONLINE' AND name NOT IN ('SSISDB','distribution') AND name NOT LIKE 'ReportServer%';
INSERT #fab SELECT 'size','allocated_size_gb', CONVERT(nvarchar(30), CAST(SUM(CAST(size AS bigint)) * 8 / 1048576.0 AS decimal(18,2)))
  FROM sys.master_files WHERE type = 0 AND database_id > 4;
INSERT #fab SELECT 'inventory','linked_server_count', CONVERT(nvarchar(20), COUNT(*)) FROM sys.servers WHERE is_linked = 1;
INSERT #fab SELECT 'workload','login_count', CONVERT(nvarchar(20), COUNT(*)) FROM sys.server_principals
  WHERE type IN ('S','U','G','E','X') AND is_disabled = 0 AND name NOT LIKE '##%' AND name NOT LIKE 'NT SERVICE\%' AND name NOT LIKE 'NT AUTHORITY\%';
INSERT #fab SELECT 'workload','user_sessions_now', CONVERT(nvarchar(20), COUNT(*)) FROM sys.dm_exec_sessions WHERE is_user_process = 1;
INSERT #fab SELECT 'cdc','cdc_enabled_dbs', CONVERT(nvarchar(20), COUNT(*)) FROM sys.databases WHERE is_cdc_enabled = 1;
INSERT #fab SELECT 'security','tde_enabled_dbs', CONVERT(nvarchar(20), COUNT(*)) FROM sys.databases WHERE is_encrypted = 1 AND database_id > 4;
BEGIN TRY
  INSERT #fab SELECT 'cdc','change_tracking_dbs', CONVERT(nvarchar(20), COUNT(*)) FROM sys.change_tracking_databases;
END TRY BEGIN CATCH INSERT #fab VALUES ('error','change_tracking', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
BEGIN TRY
  DECLARE @updays float = (SELECT DATEDIFF(minute, sqlserver_start_time, GETDATE()) / 1440.0 FROM sys.dm_os_sys_info);
  INSERT #fab SELECT 'workload','daily_batches', CONVERT(nvarchar(30), CAST(cntr_value / NULLIF(@updays, 0) AS bigint))
    FROM sys.dm_os_performance_counters WHERE counter_name LIKE 'Batch Requests/sec%' AND object_name LIKE '%SQL Statistics%';
END TRY BEGIN CATCH INSERT #fab VALUES ('error','daily_batches', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
/* Client applications connected right now (snapshot) - helps detect ETL/BI tools */
INSERT #fab SELECT TOP 25 'client_app', LEFT(ISNULL(NULLIF(program_name, ''), '(unknown)'), 200), CONVERT(nvarchar(20), COUNT(*))
  FROM sys.dm_exec_sessions WHERE is_user_process = 1 GROUP BY program_name ORDER BY COUNT(*) DESC;

/* ---- SQL Agent, SSIS, SSRS ------------------------------------------------ */
BEGIN TRY
  INSERT #fab SELECT 'etl','agent_jobs', CONVERT(nvarchar(20), COUNT(*)) FROM msdb.dbo.sysjobs WHERE enabled = 1;
  INSERT #fab SELECT 'etl','agent_job_steps_ssis', CONVERT(nvarchar(20), COUNT(*)) FROM msdb.dbo.sysjobsteps WHERE subsystem = 'SSIS';
  INSERT #fab SELECT 'etl','msdb_ssis_packages', CONVERT(nvarchar(20), COUNT(*)) FROM msdb.dbo.sysssispackages WHERE packagetype = 5;
END TRY BEGIN CATCH INSERT #fab VALUES ('error','msdb', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
IF DB_ID('SSISDB') IS NOT NULL
BEGIN
  BEGIN TRY
    EXEC (N'INSERT #fab SELECT ''etl'',''ssisdb_packages'', CONVERT(nvarchar(20), COUNT(*)) FROM SSISDB.catalog.packages;
            INSERT #fab SELECT ''etl'',''ssisdb_projects'', CONVERT(nvarchar(20), COUNT(*)) FROM SSISDB.catalog.projects;
            INSERT #fab SELECT ''etl'',''ssis_executions_30d'', CONVERT(nvarchar(20), COUNT(*)) FROM SSISDB.catalog.executions WHERE start_time > DATEADD(day, -30, SYSDATETIMEOFFSET());');
  END TRY BEGIN CATCH INSERT #fab VALUES ('error','ssisdb', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
END;
DECLARE @rs sysname = (SELECT TOP 1 name FROM sys.databases WHERE name LIKE 'ReportServer%' AND name NOT LIKE '%TempDB' ORDER BY name);
IF @rs IS NOT NULL
BEGIN
  BEGIN TRY
    DECLARE @rsql nvarchar(max) =
      N'INSERT #fab SELECT ''bi'',''ssrs_reports'', CONVERT(nvarchar(20), COUNT(*)) FROM ' + QUOTENAME(@rs) + N'.dbo.Catalog WHERE Type = 2;
        INSERT #fab SELECT ''bi'',''ssrs_shared_datasets'', CONVERT(nvarchar(20), COUNT(*)) FROM ' + QUOTENAME(@rs) + N'.dbo.Catalog WHERE Type = 8;
        INSERT #fab SELECT ''bi'',''ssrs_reports_used_recent'', CONVERT(nvarchar(20), COUNT(DISTINCT ReportID)) FROM ' + QUOTENAME(@rs) + N'.dbo.ExecutionLogStorage WHERE TimeStart > DATEADD(day, -90, GETDATE());';
    EXEC sp_executesql @rsql;
  END TRY BEGIN CATCH INSERT #fab VALUES ('error','ssrs', LEFT(ERROR_MESSAGE(), 400)); END CATCH;
END;

/* ---- Per-database scan ---------------------------------------------------- */
DECLARE @db sysname, @sql nvarchar(max);
DECLARE dbc CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.databases
  WHERE database_id > 4 AND state_desc = 'ONLINE' AND HAS_DBACCESS(name) = 1
    AND name NOT IN ('SSISDB','distribution') AND name NOT LIKE 'ReportServer%';
OPEN dbc;
FETCH NEXT FROM dbc INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'USE ' + QUOTENAME(@db) + N';
INSERT #db SELECT DB_NAME(), ''table_count'', COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''view_count'', COUNT(*) FROM sys.views WHERE is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''proc_count'', COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''function_count'', COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND type IN (''FN'',''IF'',''TF'',''FS'',''FT'');
INSERT #db SELECT DB_NAME(), ''trigger_count'', COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''sequence_count'', COUNT(*) FROM sys.sequences;
INSERT #db SELECT DB_NAME(), ''synonym_count'', COUNT(*) FROM sys.synonyms;
INSERT #db SELECT DB_NAME(), ''clr_assembly_count'', COUNT(*) FROM sys.assemblies WHERE is_user_defined = 1;
INSERT #db SELECT DB_NAME(), ''schema_count'', COUNT(*) FROM sys.schemas WHERE schema_id BETWEEN 5 AND 16383;
INSERT #db SELECT DB_NAME(), ''db_user_count'', COUNT(*) FROM sys.database_principals WHERE type IN (''S'',''U'',''G'',''E'',''X'') AND principal_id > 4;
INSERT #db SELECT DB_NAME(), ''partitioned_table_count'', COUNT(DISTINCT p.object_id) FROM sys.partitions p JOIN sys.tables t ON t.object_id = p.object_id WHERE t.is_ms_shipped = 0 AND p.partition_number > 1;
INSERT #db SELECT DB_NAME(), ''indexed_view_count'', COUNT(*) FROM sys.indexes i JOIN sys.views v ON v.object_id = i.object_id WHERE i.index_id = 1;
INSERT #db SELECT DB_NAME(), ''columnstore_index_count'', COUNT(*) FROM sys.indexes WHERE type IN (5,6);
INSERT #db SELECT DB_NAME(), ''service_queue_count'', COUNT(*) FROM sys.service_queues WHERE is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''fulltext_index_count'', COUNT(*) FROM sys.fulltext_indexes;
INSERT #db SELECT DB_NAME(), ''code_lines'', ISNULL(SUM(CAST(LEN(m.definition) - LEN(REPLACE(m.definition, NCHAR(10), N'''')) + 1 AS bigint)), 0)
  FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id WHERE o.is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''cursor_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND m.definition LIKE N''%DECLARE%CURSOR%'';
INSERT #db SELECT DB_NAME(), ''dynamic_sql_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND (m.definition LIKE N''%sp[_]executesql%'' OR m.definition LIKE N''%EXEC(%'' OR m.definition LIKE N''%EXEC (%'' OR m.definition LIKE N''%EXECUTE(%'');
INSERT #db SELECT DB_NAME(), ''temp_table_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND (m.definition LIKE N''%INTO #%'' OR m.definition LIKE N''%TABLE #%'');
INSERT #db SELECT DB_NAME(), ''merge_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND m.definition LIKE N''%MERGE%USING%'';
INSERT #db SELECT DB_NAME(), ''xml_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND (m.definition LIKE N''%FOR XML%'' OR m.definition LIKE N''%OPENXML%'' OR m.definition LIKE N''%.nodes(%'');
INSERT #db SELECT DB_NAME(), ''remote_query_objects'', COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
  WHERE o.is_ms_shipped = 0 AND (m.definition LIKE N''%OPENQUERY%'' OR m.definition LIKE N''%OPENROWSET%'' OR m.definition LIKE N''%OPENDATASOURCE%'');
INSERT #db SELECT DB_NAME(), ''cross_db_objects'', COUNT(DISTINCT referencing_id) FROM sys.sql_expression_dependencies
  WHERE referenced_database_name IS NOT NULL AND referenced_database_name <> DB_NAME();
INSERT #db SELECT DB_NAME(), ''remote_server_objects'', COUNT(DISTINCT referencing_id) FROM sys.sql_expression_dependencies WHERE referenced_server_name IS NOT NULL;
INSERT #db SELECT DB_NAME(), ''columns_total'', COUNT(*) FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id WHERE t.is_ms_shipped = 0;
INSERT #db SELECT DB_NAME(), ''col_'' + CASE WHEN ut.is_assembly_type = 1 THEN ut.name ELSE bt.name END, COUNT(*)
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  JOIN sys.types ut ON ut.user_type_id = c.user_type_id
  LEFT JOIN sys.types bt ON bt.user_type_id = c.system_type_id
  WHERE t.is_ms_shipped = 0
    AND (ut.is_assembly_type = 1 OR bt.name IN (''nvarchar'',''nchar'',''ntext'',''text'',''image'',''datetime'',''smalldatetime'',''datetimeoffset'',''money'',''smallmoney'',''tinyint'',''xml'',''sql_variant'',''timestamp''))
  GROUP BY CASE WHEN ut.is_assembly_type = 1 THEN ut.name ELSE bt.name END;
INSERT #db SELECT DB_NAME(), ''used_size_gb'', ISNULL(SUM(reserved_page_count) * 8.0 / 1048576, 0) FROM sys.dm_db_partition_stats;
INSERT #db SELECT DB_NAME(), ''total_rows'', ISNULL(SUM(CASE WHEN index_id IN (0,1) THEN row_count ELSE 0 END), 0) FROM sys.dm_db_partition_stats;
INSERT #top SELECT TOP 25 DB_NAME(), s.name, t.name, SUM(ps.reserved_page_count) * 8.0 / 1048576, SUM(CASE WHEN ps.index_id IN (0,1) THEN ps.row_count ELSE 0 END)
  FROM sys.dm_db_partition_stats ps
  JOIN sys.tables t ON t.object_id = ps.object_id
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.is_ms_shipped = 0
  GROUP BY s.name, t.name
  ORDER BY SUM(ps.reserved_page_count) DESC;';
  BEGIN TRY EXEC sp_executesql @sql; END TRY
  BEGIN CATCH INSERT #fab VALUES ('error', 'db:' + @db, LEFT(ERROR_MESSAGE(), 400)); END CATCH;

  IF @major >= 13   /* SQL Server 2016+ catalog features */
  BEGIN
    SET @sql = N'USE ' + QUOTENAME(@db) + N';
INSERT #db SELECT DB_NAME(), ''rls_policy_count'', COUNT(*) FROM sys.security_policies;
INSERT #db SELECT DB_NAME(), ''masked_column_count'', COUNT(*) FROM sys.masked_columns;
INSERT #db SELECT DB_NAME(), ''encrypted_column_count'', COUNT(*) FROM sys.columns WHERE encryption_type IS NOT NULL;
INSERT #db SELECT DB_NAME(), ''temporal_table_count'', COUNT(*) FROM sys.tables WHERE temporal_type = 2;';
    BEGIN TRY EXEC sp_executesql @sql; END TRY
    BEGIN CATCH INSERT #fab VALUES ('error', 'db2016:' + @db, LEFT(ERROR_MESSAGE(), 400)); END CATCH;
  END;
  IF @major >= 12   /* SQL Server 2014+ */
  BEGIN
    SET @sql = N'USE ' + QUOTENAME(@db) + N';
INSERT #db SELECT DB_NAME(), ''memory_optimized_table_count'', COUNT(*) FROM sys.tables WHERE is_memory_optimized = 1;';
    BEGIN TRY EXEC sp_executesql @sql; END TRY
    BEGIN CATCH INSERT #fab VALUES ('error', 'db2014:' + @db, LEFT(ERROR_MESSAGE(), 400)); END CATCH;
  END;
  FETCH NEXT FROM dbc INTO @db;
END;
CLOSE dbc;
DEALLOCATE dbc;

/* ---- Aggregate ------------------------------------------------------------- */
INSERT #fab
SELECT CASE
         WHEN metric IN ('code_lines','cursor_objects','dynamic_sql_objects','temp_table_objects','merge_objects','xml_objects',
                         'remote_query_objects','cross_db_objects','remote_server_objects') THEN 'code'
         WHEN metric LIKE 'col[_]%' OR metric = 'columns_total' THEN 'types'
         WHEN metric IN ('used_size_gb','total_rows') THEN 'size'
         WHEN metric IN ('rls_policy_count','masked_column_count','encrypted_column_count') THEN 'security'
         WHEN metric = 'db_user_count' THEN 'workload'
         ELSE 'inventory' END,
       metric,
       CONVERT(nvarchar(50), CAST(SUM(value) AS decimal(38,2)))
FROM #db GROUP BY metric;
INSERT #fab SELECT 'types','unsupported_type_columns', CONVERT(nvarchar(30), CAST(ISNULL(SUM(value), 0) AS bigint)) FROM #db WHERE metric LIKE 'col[_]%';
INSERT #fab SELECT 'size','largest_table_gb', CONVERT(nvarchar(30), CAST(ISNULL(MAX(size_gb), 0) AS decimal(18,2))) FROM #top;
IF @include_object_names = 1
  INSERT #fab SELECT TOP 25 'table_top', dbname + '.' + schema_name + '.' + table_name,
         CONVERT(nvarchar(30), CAST(size_gb AS decimal(18,2))) + '|' + CONVERT(nvarchar(30), row_count)
  FROM #top ORDER BY size_gb DESC;

/* ---- Result: save this grid as CSV ----------------------------------------- */
SELECT section, metric, value FROM #fab
ORDER BY CASE section WHEN 'platform' THEN 1 WHEN 'size' THEN 2 WHEN 'inventory' THEN 3 WHEN 'code' THEN 4 WHEN 'types' THEN 5
                      WHEN 'workload' THEN 6 WHEN 'etl' THEN 7 WHEN 'bi' THEN 8 WHEN 'cdc' THEN 9 WHEN 'security' THEN 10
                      WHEN 'client_app' THEN 11 WHEN 'table_top' THEN 12 ELSE 99 END, metric;

DROP TABLE #fab; DROP TABLE #db; DROP TABLE #top;
