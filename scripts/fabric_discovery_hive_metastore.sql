-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Hadoop data lakes - Hive / Impala / Spark SQL tables
--                    (Cloudera CDH / CDP, Hortonworks HDP, Amazon EMR,
--                    Azure HDInsight, Google Dataproc, MapR)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads the Hive METASTORE database (the MySQL/MariaDB or
--                PostgreSQL database behind the metastore service): databases,
--                tables, formats, partitions, sizes from table statistics.
--                No business data is read. Nothing is changed.
-- Permissions  : Read-only login on the metastore database.
-- How to run   : MySQL/MariaDB metastore (most common):
--                  mysql -h METASTORE_HOST -u USER -p METASTORE_DB --batch --skip-column-names --force \
--                        < fabric_discovery_hive_metastore.sql > fabric_discovery_hive.tsv
--                PostgreSQL metastore: table names are upper case, so run
--                  psql ... -c "SET search_path TO public" and wrap each table
--                  name in double quotes ("TBLS", "DBS", ...) before running.
-- Note         : Sizes come from table statistics (totalSize); run
--                ANALYZE TABLE / COMPUTE STATS for tables that show 0, or
--                enter HDFS usage (hdfs dfs -du -s -h /warehouse) by hand.
-- =============================================================================
SELECT 'platform', 'platform', 'hive';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', SCHEMA_VERSION FROM VERSION;
SELECT 'size', 'total_size_gb', ROUND(SUM(CAST(PARAM_VALUE AS DECIMAL(30, 0))) / 1073741824, 2) FROM TABLE_PARAMS WHERE PARAM_KEY = 'totalSize';
SELECT 'size', 'partition_size_gb', ROUND(SUM(CAST(PARAM_VALUE AS DECIMAL(30, 0))) / 1073741824, 2) FROM PARTITION_PARAMS WHERE PARAM_KEY = 'totalSize';
SELECT 'size', 'largest_table_gb', ROUND(MAX(CAST(PARAM_VALUE AS DECIMAL(30, 0))) / 1073741824, 2) FROM TABLE_PARAMS WHERE PARAM_KEY = 'totalSize';
SELECT 'inventory', 'database_count', COUNT(*) FROM DBS;
SELECT 'inventory', 'table_count', COUNT(*) FROM TBLS WHERE TBL_TYPE IN ('MANAGED_TABLE', 'EXTERNAL_TABLE');
SELECT 'inventory', 'external_table_count', COUNT(*) FROM TBLS WHERE TBL_TYPE = 'EXTERNAL_TABLE';
SELECT 'inventory', 'view_count', COUNT(*) FROM TBLS WHERE TBL_TYPE = 'VIRTUAL_VIEW';
SELECT 'inventory', 'mview_count', COUNT(*) FROM TBLS WHERE TBL_TYPE = 'MATERIALIZED_VIEW';
SELECT 'inventory', 'partitioned_table_count', COUNT(DISTINCT TBL_ID) FROM PARTITION_KEYS;
SELECT 'inventory', 'partition_count', COUNT(*) FROM PARTITIONS;
SELECT 'inventory', 'function_count', COUNT(*) FROM FUNCS;
SELECT 'inventory', 'acid_table_count', COUNT(*) FROM TABLE_PARAMS WHERE PARAM_KEY = 'transactional' AND LOWER(PARAM_VALUE) = 'true';
SELECT 'inventory', 'hbase_kudu_table_count', COUNT(*) FROM TABLE_PARAMS WHERE PARAM_KEY = 'storage_handler' AND (PARAM_VALUE LIKE '%HBase%' OR PARAM_VALUE LIKE '%Kudu%');
SELECT 'types', CONCAT('format_', CASE
         WHEN s.INPUT_FORMAT LIKE '%Parquet%' THEN 'parquet' WHEN s.INPUT_FORMAT LIKE '%Orc%' THEN 'orc'
         WHEN s.INPUT_FORMAT LIKE '%Avro%' THEN 'avro' WHEN s.INPUT_FORMAT LIKE '%Text%' THEN 'text'
         WHEN s.INPUT_FORMAT LIKE '%Sequence%' THEN 'sequence' ELSE 'other' END), COUNT(*)
  FROM TBLS t JOIN SDS s ON s.SD_ID = t.SD_ID WHERE t.TBL_TYPE IN ('MANAGED_TABLE', 'EXTERNAL_TABLE') GROUP BY 2;
SELECT 'types', 'complex_columns', COUNT(*) FROM COLUMNS_V2 WHERE TYPE_NAME LIKE 'array%' OR TYPE_NAME LIKE 'map%' OR TYPE_NAME LIKE 'struct%' OR TYPE_NAME LIKE 'uniontype%';
SELECT 'code', 'view_lines', COALESCE(SUM(LENGTH(VIEW_EXPANDED_TEXT) - LENGTH(REPLACE(VIEW_EXPANDED_TEXT, CHAR(10), '')) + 1), 0) FROM TBLS WHERE TBL_TYPE = 'VIRTUAL_VIEW';
SELECT 'table_top', REPLACE(CONCAT(d.NAME, '.', t.TBL_NAME), ',', ' '), CONCAT(ROUND(CAST(p.PARAM_VALUE AS DECIMAL(30, 0)) / 1073741824, 3), '|')
  FROM TBLS t JOIN DBS d ON d.DB_ID = t.DB_ID JOIN TABLE_PARAMS p ON p.TBL_ID = t.TBL_ID AND p.PARAM_KEY = 'totalSize'
 ORDER BY CAST(p.PARAM_VALUE AS DECIMAL(30, 0)) DESC LIMIT 25;
