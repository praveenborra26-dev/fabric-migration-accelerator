-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : SAP HANA native / sidecar (non-ABAP schemas, calculation views)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : One read-only query over HANA system views (SYS.TABLES, VIEWS,
--                PROCEDURES, M_TABLE_PERSISTENCE_STATISTICS). No business data.
-- Permissions  : CATALOG READ.
-- How to run   : SAP HANA Database Explorer / HANA Studio / hdbsql -> run ->
--                export the grid as CSV.
-- Scope        : All non-system schemas. Add AND SCHEMA_NAME IN (...) filters
--                if the database also hosts schemas that are out of scope.
-- =============================================================================
SELECT CAST('platform' AS NVARCHAR(40)) AS SEC, CAST('platform' AS NVARCHAR(256)) AS METRIC_NAME, CAST('sap_hana' AS NVARCHAR(1000)) AS METRIC_VALUE FROM DUMMY
UNION ALL SELECT 'platform', 'script_version', '2026.11' FROM DUMMY
UNION ALL SELECT 'platform', 'version', VERSION FROM SYS.M_DATABASE
UNION ALL SELECT 'size', 'total_size_gb', TO_VARCHAR(ROUND(SUM(DISK_SIZE) / 1073741824, 2))
            FROM SYS.M_TABLE_PERSISTENCE_STATISTICS
           WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM','UIS','HANA_XS_BASE','SAP_REST_API','SAPDBCTRL')
UNION ALL SELECT 'inventory', 'schema_count', TO_VARCHAR(COUNT(*)) FROM SYS.SCHEMAS
           WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM','UIS','HANA_XS_BASE','SAP_REST_API','SAPDBCTRL')
UNION ALL SELECT 'inventory', 'table_count', TO_VARCHAR(COUNT(*)) FROM SYS.TABLES
           WHERE IS_SYSTEM_TABLE = 'FALSE' AND SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'inventory', 'view_count', TO_VARCHAR(COUNT(*)) FROM SYS.VIEWS
           WHERE VIEW_TYPE <> 'CALC' AND SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'inventory', 'calc_view_count', TO_VARCHAR(COUNT(*)) FROM SYS.VIEWS
           WHERE VIEW_TYPE = 'CALC' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'inventory', 'proc_count', TO_VARCHAR(COUNT(*)) FROM SYS.PROCEDURES
           WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'inventory', 'function_count', TO_VARCHAR(COUNT(*)) FROM SYS.FUNCTIONS
           WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'code', 'code_chars', TO_VARCHAR(SUM(LENGTH(DEFINITION))) FROM SYS.PROCEDURES
           WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT 'workload', 'user_count', TO_VARCHAR(COUNT(*)) FROM SYS.USERS
           WHERE USER_DEACTIVATED = 'FALSE' AND USER_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND USER_NAME NOT IN ('SYS','SYSTEM')
UNION ALL SELECT * FROM (
            SELECT TOP 25 'table_top', SCHEMA_NAME || '.' || TABLE_NAME, TO_VARCHAR(ROUND(DISK_SIZE / 1073741824, 2))
              FROM SYS.M_TABLE_PERSISTENCE_STATISTICS
             WHERE SCHEMA_NAME NOT LIKE '\_SYS%' ESCAPE '\' AND SCHEMA_NAME NOT IN ('SYS','SYSTEM')
             ORDER BY DISK_SIZE DESC);
