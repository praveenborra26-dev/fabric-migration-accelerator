-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Google BigQuery (one project, one region per run)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads INFORMATION_SCHEMA views only (tables, storage, routines,
--                columns, jobs). No business data is read. Creates one TEMP
--                table that disappears when the script ends.
-- Permissions  : roles/bigquery.metadataViewer and roles/bigquery.resourceViewer
--                (for JOBS_BY_PROJECT) on the project, plus bigquery.jobs.create.
-- How to run   : 1) Set the region below (e.g. region-us, region-eu,
--                   region-europe-west2). Run once per region you use.
--                2) Paste into the BigQuery console and run.
-- Output       : The last result (section, metric, value). Save results ->
--                CSV, then import it in the accelerator. Several regions:
--                drop all the files together.
-- Cost         : INFORMATION_SCHEMA queries are billed like normal queries
--                (usually a few MB).
-- =============================================================================
DECLARE region STRING DEFAULT 'region-us';
DECLARE stmts ARRAY<STRING>;
DECLARE i INT64 DEFAULT 0;

CREATE TEMP TABLE fab_disc (section STRING, metric STRING, value STRING);
INSERT INTO fab_disc VALUES ('platform', 'platform', 'bigquery'), ('platform', 'script_version', '2026.11'), ('platform', 'version', 'BigQuery'), ('platform', 'region', region);

SET stmts = [
  -- size
  "SELECT 'size', 'total_size_gb', CAST(ROUND(SUM(total_logical_bytes) / POW(1024, 3), 2) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLE_STORAGE WHERE NOT deleted",
  "SELECT 'size', 'physical_size_gb', CAST(ROUND(SUM(total_physical_bytes) / POW(1024, 3), 2) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLE_STORAGE WHERE NOT deleted",
  "SELECT 'size', 'largest_table_gb', CAST(ROUND(MAX(total_logical_bytes) / POW(1024, 3), 2) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLE_STORAGE WHERE NOT deleted",
  -- inventory
  "SELECT 'inventory', 'schema_count', CAST(COUNT(*) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.SCHEMATA",
  "SELECT 'inventory', 'table_count', CAST(COUNTIF(table_type = 'BASE TABLE') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLES",
  "SELECT 'inventory', 'view_count', CAST(COUNTIF(table_type = 'VIEW') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLES",
  "SELECT 'inventory', 'mview_count', CAST(COUNTIF(table_type = 'MATERIALIZED VIEW') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLES",
  "SELECT 'inventory', 'external_table_count', CAST(COUNTIF(table_type = 'EXTERNAL') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLES",
  "SELECT 'inventory', 'snapshot_count', CAST(COUNTIF(table_type IN ('SNAPSHOT', 'CLONE')) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLES",
  "SELECT 'inventory', 'partitioned_table_count', CAST(COUNT(DISTINCT table_schema || '.' || table_name) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMNS WHERE is_partitioning_column = 'YES'",
  "SELECT 'inventory', 'proc_count', CAST(COUNTIF(routine_type = 'PROCEDURE') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROUTINES",
  "SELECT 'inventory', 'function_count', CAST(COUNTIF(routine_type IN ('FUNCTION', 'TABLE FUNCTION', 'AGGREGATE FUNCTION')) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROUTINES",
  "SELECT 'code', 'js_function_count', CAST(COUNTIF(UPPER(IFNULL(external_language, '')) IN ('JAVASCRIPT', 'JS')) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROUTINES",
  "SELECT 'code', 'remote_function_count', CAST(COUNTIF(UPPER(IFNULL(external_language, '')) NOT IN ('', 'SQL', 'JAVASCRIPT', 'JS')) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROUTINES",
  "SELECT 'code', 'code_lines', CAST(IFNULL(SUM(ARRAY_LENGTH(SPLIT(routine_definition, '\\n'))), 0) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROUTINES",
  "SELECT 'code', 'view_lines', CAST(IFNULL(SUM(ARRAY_LENGTH(SPLIT(view_definition, '\\n'))), 0) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.VIEWS",
  "SELECT 'code', 'ml_model_queries', CAST(COUNT(*) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND statement_type IN ('CREATE_MODEL')",
  -- types
  "SELECT 'types', 'nested_columns', CAST(COUNTIF(data_type LIKE 'STRUCT%' OR data_type LIKE 'ARRAY%') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMNS",
  "SELECT 'types', 'json_columns', CAST(COUNTIF(data_type = 'JSON') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMNS",
  "SELECT 'types', 'spatial_columns', CAST(COUNTIF(data_type = 'GEOGRAPHY') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMNS",
  "SELECT 'types', 'interval_range_columns', CAST(COUNTIF(data_type = 'INTERVAL' OR data_type LIKE 'RANGE%' OR data_type = 'BIGNUMERIC') AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMNS",
  -- security
  "SELECT 'security', 'rls_policy_count', CAST(COUNT(*) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.ROW_ACCESS_POLICIES",
  "SELECT 'security', 'masked_column_count', CAST(COUNT(*) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS WHERE ARRAY_LENGTH(policy_tags) > 0",
  -- workload (last 30 days)
  "SELECT 'workload', 'queries_30d', CAST(COUNT(*) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND job_type = 'QUERY'",
  "SELECT 'workload', 'dbql_days', '30'",
  "SELECT 'workload', 'peak_hour_queries', CAST(MAX(c) AS STRING) FROM (SELECT TIMESTAMP_TRUNC(creation_time, HOUR) h, COUNT(*) c FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND job_type = 'QUERY' GROUP BY 1)",
  "SELECT 'workload', 'user_count', CAST(COUNT(DISTINCT user_email) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)",
  "SELECT 'workload', 'avg_slots', CAST(ROUND(SUM(total_slot_ms) / (1000 * 60 * 60 * 24 * 30), 1) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)",
  "SELECT 'workload', 'billed_tb_30d', CAST(ROUND(SUM(total_bytes_billed) / POW(1024, 4), 2) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)",
  "SELECT 'etl', 'scheduler_jobs', CAST(COUNT(DISTINCT query) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND job_id LIKE 'scheduled_query%'",
  "SELECT 'workload', 'streaming_tables', CAST(COUNT(DISTINCT dataset_id || '.' || table_id) AS STRING) FROM `{r}`.INFORMATION_SCHEMA.STREAMING_TIMELINE_BY_PROJECT WHERE start_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)",
  -- largest tables
  "SELECT 'table_top', table_schema || '.' || table_name, CAST(ROUND(total_logical_bytes / POW(1024, 3), 3) AS STRING) || '|' || CAST(total_rows AS STRING) FROM `{r}`.INFORMATION_SCHEMA.TABLE_STORAGE WHERE NOT deleted ORDER BY total_logical_bytes DESC LIMIT 25"
];

WHILE i < ARRAY_LENGTH(stmts) DO
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO fab_disc ' || REPLACE(stmts[OFFSET(i)], '{r}', region);
  EXCEPTION WHEN ERROR THEN
    INSERT INTO fab_disc VALUES ('error', CONCAT('statement_', CAST(i AS STRING)), SUBSTR(REPLACE(@@error.message, ',', ' '), 1, 300));
  END;
  SET i = i + 1;
END WHILE;

SELECT section, REPLACE(metric, ',', ' ') AS metric, REPLACE(IFNULL(value, '0'), ',', ' ') AS value FROM fab_disc ORDER BY section, metric;
