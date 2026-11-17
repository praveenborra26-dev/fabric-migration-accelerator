-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : SAP ECC 6.0 / SAP S/4HANA running on SAP HANA
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : One read-only query over the ABAP dictionary (TADIR, USR02,
--                TBTCO, ROOSOURCE) and HANA monitoring views. No business data.
-- BEFORE RUNNING: Ask your SAP Basis team. Many SAP HANA licences are runtime
--                licences that restrict direct SQL access by non-SAP tools. If
--                direct reads are not allowed, use the transaction checklist
--                (fabric_discovery_sap_checklist.csv) instead.
-- How to run   : SAP HANA Database Explorer / HANA Studio / hdbsql, connected
--                with a read-only user. Replace SAPHANADB with your ABAP schema
--                (often SAPHANADB, SAPABAP1 or SAPSR3), run, export the grid as CSV.
-- Other DBs    : On Oracle/Db2/SQL Server, use the same tables in schema SAPSR3
--                (change TO_VARCHAR to TO_CHAR or CAST, and FROM DUMMY to FROM DUAL).
-- =============================================================================
SET SCHEMA SAPHANADB;

SELECT CAST('platform' AS NVARCHAR(40)) AS SEC, CAST('platform' AS NVARCHAR(256)) AS METRIC_NAME, CAST('sap_erp' AS NVARCHAR(1000)) AS METRIC_VALUE FROM DUMMY
UNION ALL SELECT 'platform', 'script_version', '2026.11' FROM DUMMY
UNION ALL SELECT 'platform', 'db', 'hana' FROM DUMMY
UNION ALL SELECT 'platform', 'hana_version', VERSION FROM SYS.M_DATABASE
UNION ALL SELECT 'size', 'total_size_gb', TO_VARCHAR(ROUND(SUM(DISK_SIZE) / 1073741824, 2))
            FROM SYS.M_TABLE_PERSISTENCE_STATISTICS WHERE SCHEMA_NAME = CURRENT_SCHEMA
UNION ALL SELECT 'size', 'memory_size_gb', TO_VARCHAR(ROUND(SUM(MEMORY_SIZE_IN_TOTAL) / 1073741824, 2))
            FROM SYS.M_CS_TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA
UNION ALL SELECT 'sap', 'table_count', TO_VARCHAR(COUNT(*)) FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA
UNION ALL SELECT 'sap', 'custom_' || LOWER(OBJECT), TO_VARCHAR(COUNT(*))
            FROM TADIR
           WHERE PGMID = 'R3TR'
             AND OBJECT IN ('TABL','VIEW','DDLS','PROG','FUGR','CLAS','TRAN','ENHO')
             AND (OBJ_NAME LIKE 'Z%' OR OBJ_NAME LIKE 'Y%')
           GROUP BY OBJECT
UNION ALL SELECT 'sap', 'dialog_users', TO_VARCHAR(COUNT(DISTINCT BNAME)) FROM USR02 WHERE USTYP = 'A' AND UFLAG = 0
UNION ALL SELECT 'sap', 'bg_jobs_30d', TO_VARCHAR(COUNT(*)) FROM TBTCO
           WHERE SDLSTRTDT >= TO_VARCHAR(ADD_DAYS(CURRENT_DATE, -30), 'YYYYMMDD')
UNION ALL SELECT 'sap', 'active_datasources', TO_VARCHAR(COUNT(*)) FROM ROOSOURCE WHERE OBJVERS = 'A'
UNION ALL SELECT * FROM (
            SELECT TOP 25 'table_top', TABLE_NAME, TO_VARCHAR(ROUND(DISK_SIZE / 1073741824, 2))
              FROM SYS.M_TABLE_PERSISTENCE_STATISTICS
             WHERE SCHEMA_NAME = CURRENT_SCHEMA
             ORDER BY DISK_SIZE DESC);
