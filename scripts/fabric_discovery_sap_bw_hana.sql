-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : SAP BW 7.3 / 7.4 / 7.5 and SAP BW/4HANA on SAP HANA
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Read-only counts of BW metadata (InfoObjects, queries, process
--                chains, transformations, DataSources, providers). No data read.
-- BEFORE RUNNING: Confirm with SAP Basis that direct SQL reads are allowed under
--                your HANA licence; otherwise use the transaction checklist.
-- How to run   : Replace SAPHANADB with your BW ABAP schema and run QUERY 1.
--                Then run QUERY 2 (BW 7.4+ and BW/4HANA) and/or QUERY 3 (classic
--                BW objects, not on BW/4HANA). Export each grid as CSV; the
--                importer accepts several files for the same system.
-- =============================================================================
SET SCHEMA SAPHANADB;

-- QUERY 1 - all BW releases
SELECT CAST('platform' AS NVARCHAR(40)) AS SEC, CAST('platform' AS NVARCHAR(256)) AS METRIC_NAME, CAST('sap_bw' AS NVARCHAR(1000)) AS METRIC_VALUE FROM DUMMY
UNION ALL SELECT 'platform', 'script_version', '2026.11' FROM DUMMY
UNION ALL SELECT 'platform', 'db', 'hana' FROM DUMMY
UNION ALL SELECT 'platform', 'hana_version', VERSION FROM SYS.M_DATABASE
UNION ALL SELECT 'size', 'total_size_gb', TO_VARCHAR(ROUND(SUM(DISK_SIZE) / 1073741824, 2))
            FROM SYS.M_TABLE_PERSISTENCE_STATISTICS WHERE SCHEMA_NAME = CURRENT_SCHEMA
UNION ALL SELECT 'bw', 'infoobjects', TO_VARCHAR(COUNT(*)) FROM RSDIOBJ WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'queries', TO_VARCHAR(COUNT(*)) FROM RSZCOMPDIR WHERE OBJVERS = 'A' AND DEFTP = 'REP'
UNION ALL SELECT 'bw', 'process_chains', TO_VARCHAR(COUNT(DISTINCT CHAIN_ID)) FROM RSPCCHAIN WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'transformations', TO_VARCHAR(COUNT(*)) FROM RSTRAN WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'datasources', TO_VARCHAR(COUNT(*)) FROM RSDS WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'open_hub_destinations', TO_VARCHAR(COUNT(*)) FROM RSBOHDEST WHERE OBJVERS = 'A'
UNION ALL SELECT 'sap', 'dialog_users', TO_VARCHAR(COUNT(DISTINCT BNAME)) FROM USR02 WHERE USTYP = 'A' AND UFLAG = 0
UNION ALL SELECT 'sap', 'bg_jobs_30d', TO_VARCHAR(COUNT(*)) FROM TBTCO
           WHERE SDLSTRTDT >= TO_VARCHAR(ADD_DAYS(CURRENT_DATE, -30), 'YYYYMMDD')
UNION ALL SELECT * FROM (
            SELECT TOP 25 'table_top', TABLE_NAME, TO_VARCHAR(ROUND(DISK_SIZE / 1073741824, 2))
              FROM SYS.M_TABLE_PERSISTENCE_STATISTICS
             WHERE SCHEMA_NAME = CURRENT_SCHEMA
             ORDER BY DISK_SIZE DESC);

-- QUERY 2 - BW 7.4+ and BW/4HANA objects
SELECT CAST('bw' AS NVARCHAR(40)) AS SEC, CAST('adsos' AS NVARCHAR(256)) AS METRIC_NAME, TO_NVARCHAR(COUNT(*)) AS METRIC_VALUE FROM RSOADSO WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'composite_providers', TO_VARCHAR(COUNT(*)) FROM RSOHCPR WHERE OBJVERS = 'A';

-- QUERY 3 - classic objects (BW 7.x only)
SELECT CAST('bw' AS NVARCHAR(40)) AS SEC, CAST('infocubes' AS NVARCHAR(256)) AS METRIC_NAME, TO_NVARCHAR(COUNT(*)) AS METRIC_VALUE FROM RSDCUBE WHERE OBJVERS = 'A'
UNION ALL SELECT 'bw', 'classic_dsos', TO_VARCHAR(COUNT(*)) FROM RSDODSO WHERE OBJVERS = 'A';
