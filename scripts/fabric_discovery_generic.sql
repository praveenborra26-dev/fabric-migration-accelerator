-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : ANY SQL database with an ANSI INFORMATION_SCHEMA
--                    (for platforms without a dedicated script: MariaDB
--                    ColumnStore, SingleStore, CockroachDB, YugabyteDB,
--                    Trino / Presto / Starburst, Dremio, Firebolt, Yellowbrick,
--                    Actian, H2, HSQLDB, Informix with information_schema, ...)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Counts tables, views, routines and column types from
--                INFORMATION_SCHEMA. No business data is read. Size and
--                workload are not standard: enter them by hand in the
--                accelerator (or add a query from your platform's catalog).
-- How to run   : Run each statement with your platform's SQL client, output as
--                CSV without headers (for example -A -t -F ',' style flags).
--                Statements that your platform rejects can be skipped.
--                Change 'other' in the first line to a short platform name
--                if you like (for example 'trino').
-- =============================================================================
SELECT 'platform', 'platform', 'other';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'inventory', 'schema_count', COUNT(*) FROM information_schema.schemata WHERE LOWER(schema_name) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql', 'performance_schema');
SELECT 'inventory', 'table_count', COUNT(*) FROM information_schema.tables WHERE table_type IN ('BASE TABLE', 'TABLE') AND LOWER(table_schema) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql', 'performance_schema');
SELECT 'inventory', 'view_count', COUNT(*) FROM information_schema.tables WHERE table_type = 'VIEW' AND LOWER(table_schema) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql', 'performance_schema');
SELECT 'inventory', 'proc_count', COUNT(*) FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND LOWER(routine_schema) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql');
SELECT 'inventory', 'function_count', COUNT(*) FROM information_schema.routines WHERE routine_type = 'FUNCTION' AND LOWER(routine_schema) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql');
SELECT 'inventory', 'column_count', COUNT(*) FROM information_schema.columns WHERE LOWER(table_schema) NOT IN ('information_schema', 'pg_catalog', 'sys', 'system', 'mysql', 'performance_schema');
SELECT 'types', 'json_xml_columns', COUNT(*) FROM information_schema.columns WHERE LOWER(data_type) IN ('json', 'jsonb', 'xml', 'variant', 'super');
SELECT 'types', 'complex_columns', COUNT(*) FROM information_schema.columns WHERE LOWER(data_type) LIKE 'array%' OR LOWER(data_type) LIKE 'struct%' OR LOWER(data_type) LIKE 'map%' OR LOWER(data_type) LIKE 'row%' OR LOWER(data_type) = 'user-defined';
SELECT 'types', 'spatial_columns', COUNT(*) FROM information_schema.columns WHERE LOWER(data_type) LIKE 'geo%';
SELECT 'types', 'tz_columns', COUNT(*) FROM information_schema.columns WHERE LOWER(data_type) LIKE '%with time zone%';
