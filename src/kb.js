/* Fabric Migration Assessment Accelerator — knowledge base and questionnaire schema.
   Facts reflect Microsoft Fabric as documented up to November 2026; every number that
   drives cost or sizing is exposed in Rates & assumptions so it can be changed. */
(function (root) {
  'use strict';

  const o = (pairs) => pairs.map(([k, l]) => ({ k, l }));

  const OPT = {
    industry: o([['fs', 'Financial services / banking'], ['ins', 'Insurance'], ['hls', 'Healthcare & life sciences'], ['retail', 'Retail & consumer goods'], ['mfg', 'Manufacturing'], ['energy', 'Energy & utilities'], ['telco', 'Telecom & media'], ['public', 'Public sector / government'], ['transport', 'Transportation & logistics'], ['tech', 'Technology & software'], ['edu', 'Education'], ['other', 'Other']]),
    size: o([['xs', 'Under 1,000 employees'], ['s', '1,000 – 5,000'], ['m', '5,000 – 20,000'], ['l', '20,000 – 100,000'], ['xl', 'Over 100,000']]),
    region: o([['na', 'North America'], ['eu', 'Europe (EU / EEA)'], ['uk', 'United Kingdom'], ['apac', 'Asia Pacific'], ['mea', 'Middle East & Africa'], ['latam', 'Latin America']]),
    drivers: o([['cost', 'Reduce cost / exit legacy licences'], ['eol', 'Hardware, contract or support end-of-life'], ['ai', 'Modernize for AI & advanced analytics'], ['rt', 'Real-time / near-real-time analytics'], ['consol', 'Consolidate platforms'], ['selfservice', 'Self-service BI'], ['gov', 'Governance, quality & compliance'], ['ma', 'M&A / divestiture'], ['cloud', 'Cloud-first mandate'], ['sap', 'SAP transformation (S/4HANA, BDC)']]),
    ms: o([['e5', 'Microsoft 365 E5 (includes Power BI Pro)'], ['e3', 'Microsoft 365 E3'], ['pbipro', 'Power BI Pro licences'], ['pbipsku', 'Power BI Premium (P-SKU)'], ['fsku', 'Fabric capacity (F-SKU) already'], ['azure', 'Azure subscription & landing zone'], ['entra', 'Entra ID'], ['purview', 'Microsoft Purview'], ['synapse', 'Azure Synapse Analytics'], ['adf', 'Azure Data Factory'], ['dbx', 'Azure Databricks']]),
    etlTools: o([['ssis', 'SSIS'], ['infa', 'Informatica PowerCenter'], ['iics', 'Informatica IDMC / IICS'], ['datastage', 'IBM DataStage'], ['talend', 'Talend'], ['odi', 'Oracle Data Integrator'], ['bods', 'SAP Data Services (BODS)'], ['slt', 'SAP SLT'], ['abinitio', 'Ab Initio'], ['bteq', 'Teradata BTEQ / TPT scripts'], ['adf', 'Azure Data Factory / Synapse pipelines'], ['sproc', 'Stored-procedure ELT'], ['custom', 'Custom scripts (Python, shell, Perl)'], ['other', 'Other']]),
    etlMix: o([['simple', 'Mostly simple (about 60% simple)'], ['balanced', 'Balanced (about 40 / 40 / 20)'], ['complex', 'Mostly complex (about 40% complex)']]),
    scheduler: o([['native', 'Tool-native scheduling'], ['agent', 'SQL Server Agent'], ['controlm', 'Control-M'], ['autosys', 'AutoSys'], ['tws', 'IBM Workload Scheduler (Tivoli)'], ['cron', 'cron / Windows Task Scheduler'], ['other', 'Other']]),
    latency: o([['daily', 'Daily batch'], ['hourly', 'Intra-day (hourly)'], ['near_rt', 'Near real-time (minutes)'], ['rt', 'Real-time streaming (seconds)']]),
    cdcTools: o([['none', 'None'], ['gg', 'Oracle GoldenGate'], ['qlik', 'Qlik Replicate'], ['iidr', 'IBM InfoSphere CDC (IIDR)'], ['debezium', 'Debezium / Kafka'], ['striim', 'Striim'], ['mssqlcdc', 'SQL Server CDC'], ['slt', 'SAP SLT'], ['other', 'Other']]),
    biTools: o([['pbi', 'Power BI'], ['ssrs', 'SSRS'], ['ssas_tab', 'SSAS Tabular'], ['ssas_md', 'SSAS Multidimensional'], ['tableau', 'Tableau'], ['qlik', 'Qlik'], ['mstr', 'MicroStrategy'], ['cognos', 'IBM Cognos'], ['bo', 'SAP BusinessObjects'], ['bex', 'SAP BEx / Analysis for Office'], ['sac', 'SAP Analytics Cloud'], ['obiee', 'OBIEE / Oracle Analytics'], ['looker', 'Looker'], ['excel', 'Excel-based reporting'], ['other', 'Other']]),
    dsTools: o([['none', 'None'], ['sas', 'SAS'], ['notebooks', 'Python / R notebooks'], ['azureml', 'Azure Machine Learning'], ['dbx', 'Databricks'], ['spss', 'SPSS'], ['other', 'Other']]),
    ai: o([['none', 'No near-term plans'], ['copilot', 'Copilot for BI / natural-language Q&A'], ['agents', 'Data agents / GenAI on enterprise data'], ['ml', 'ML models in production']]),
    regs: o([['gdpr', 'GDPR'], ['hipaa', 'HIPAA'], ['pci', 'PCI DSS'], ['sox', 'SOX'], ['glba', 'GLBA'], ['fedramp', 'FedRAMP / government cloud'], ['ccpa', 'CCPA / CPRA'], ['iso', 'ISO 27001'], ['dora', 'DORA (EU financial)'], ['residency', 'Data residency mandate'], ['none', 'None specific']]),
    pii: o([['none', 'No personal data'], ['some', 'Some personal data'], ['extensive', 'Extensive personal / sensitive data']]),
    rls: o([['none', 'None'], ['basic', 'Basic (a few roles)'], ['complex', 'Complex (many rules, org hierarchies)']]),
    yesno: o([['yes', 'Yes'], ['no', 'No']]),
    identity: o([['entra', 'Entra ID (cloud)'], ['hybrid', 'Active Directory synced to Entra ID'], ['other_idp', 'Other IdP (Okta, Ping…)'], ['legacy', 'LDAP / Kerberos only']]),
    catalog: o([['purview', 'Microsoft Purview'], ['collibra', 'Collibra'], ['alation', 'Alation'], ['informatica', 'Informatica EDC / CDGC'], ['none', 'None']]),
    network: o([['public', 'Public endpoints with Entra ID are acceptable'], ['private', 'Private endpoints / no public access'], ['isolated', 'Fully isolated (strict outbound controls)']]),
    envs: o([['1', 'Production only'], ['2', 'Dev + Prod'], ['3', 'Dev + Test + Prod'], ['4', 'Dev + Test + UAT + Prod']]),
    dr: o([['none', 'None'], ['backup', 'Backup & restore (RTO days)'], ['warm', 'Warm standby (RTO hours)'], ['hot', 'Hot standby (RTO minutes)']]),
    devops: o([['manual', 'Manual deployments'], ['partial', 'Partial (Git for some assets)'], ['mature', 'Mature CI/CD']]),
    skill: o([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]),
    delivery: o([['inhouse', 'In-house team'], ['partner', 'Partner-led'], ['hybrid', 'Hybrid']]),
    strategy: o([['recommend', 'Let the accelerator recommend'], ['lift', 'Lift & shift (fastest, minimal redesign)'], ['replatform', 'Replatform, modernize where it pays'], ['modernize', 'Full modernization (medallion redesign)']]),
    compute: o([['recommend', 'Let the accelerator recommend'], ['warehouse', 'Warehouse first (T-SQL)'], ['lakehouse', 'Lakehouse first (Spark)'], ['both', 'Both']]),
    cutover: o([['recommend', 'Let the accelerator recommend'], ['phased', 'Phased by subject area'], ['bigbang', 'Big-bang']]),
    purchase: o([['recommend', 'Let the accelerator recommend'], ['payg', 'Pay-as-you-go'], ['reserved', '1-year reservation']]),
    role: o([['edw', 'Enterprise data warehouse'], ['mart', 'Data mart'], ['ods', 'Operational data store'], ['oltp', 'Operational (OLTP) source'], ['replica', 'Reporting replica'], ['erp', 'ERP system']]),
    deploy: o([['onprem', 'On-premises servers'], ['iaas', 'Cloud VM (IaaS)'], ['appliance', 'Appliance (Exadata, IntelliFlex, Netezza…)'], ['mainframe', 'Mainframe'], ['managed', 'Managed cloud service']]),
    scope: o([['full', 'Migrate & decommission'], ['offload', 'Offload analytics only (source stays)'], ['replicate', 'Replicate data for reporting']]),
    cdc: o([['enabled', 'Enabled / in use'], ['possible', 'Possible (can be enabled)'], ['none', 'Not available']]),
    codeMix: o([['simple', 'Mostly simple'], ['balanced', 'Balanced'], ['complex', 'Mostly complex']]),
    sapDb: o([['hana', 'SAP HANA'], ['oracle', 'Oracle'], ['db2', 'IBM Db2'], ['mssql', 'SQL Server'], ['maxdb', 'MaxDB'], ['ase', 'SAP ASE']]),
    sapModules: o([['fi', 'FI'], ['co', 'CO'], ['sd', 'SD'], ['mm', 'MM'], ['pp', 'PP'], ['pm', 'PM'], ['qm', 'QM'], ['ps', 'PS'], ['hcm', 'HCM'], ['wm', 'WM'], ['ewm', 'EWM'], ['tm', 'TM'], ['crm', 'CRM'], ['is', 'Industry solution']]),
    sapExtract: o([['bw_odp', 'BW extractors via ODP (SAP to SAP)'], ['slt', 'SAP SLT'], ['bods', 'SAP Data Services'], ['adf_cdc', 'Azure Data Factory SAP CDC connector (ODP-RFC)'], ['thirdparty', 'Third-party tool (Theobald, Qlik, Fivetran…)'], ['odata', 'OData services'], ['custom_rfc', 'Custom ABAP / RFC extracts'], ['db', 'Direct database reads'], ['datasphere', 'SAP Datasphere replication flows'], ['none', 'Nothing yet']]),
    datasphere: o([['licensed', 'Licensed / in use'], ['planned', 'Planned'], ['no', 'No']]),
    bdc: o([['adopted', 'Adopted'], ['evaluating', 'Evaluating'], ['no', 'No']]),
    s4: o([['done', 'Already on S/4HANA'], ['inflight', 'S/4HANA program in flight'], ['planned', 'Planned'], ['none', 'No plan yet']]),
    level: o([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]),
    bwFrontend: o([['afo', 'Analysis for Office'], ['bex', 'BEx Analyzer / Web'], ['sac', 'SAP Analytics Cloud'], ['bo', 'BusinessObjects'], ['pbi', 'Power BI (BW connector)'], ['other', 'Other']]),
    hanaLicense: o([['full', 'Full-use licence'], ['runtime', 'Runtime licence (via SAP application)'], ['unknown', 'Not sure']])
  };

  /* Size anchor: multiplier applied to the platform's typical footprint at 5,000–20,000 employees */
  const SIZE_MULT = { xs: 0.15, s: 0.4, m: 1, l: 2.5, xl: 5 };
  const SIZE_BASE = {
    reports: { xs: 80, s: 300, m: 1000, l: 3000, xl: 7000 },
    viewers: { xs: 100, s: 500, m: 2000, l: 7000, xl: 20000 },
    etlJobs: { xs: 40, s: 150, m: 500, l: 1500, xl: 3500 },
    feeds: { xs: 8, s: 20, m: 60, l: 150, xl: 300 },
    teamFte: { xs: 2, s: 4, m: 8, l: 15, xl: 30 },
    dbUsers: { xs: 40, s: 150, m: 500, l: 1500, xl: 3000 },
    queries: { xs: 3000, s: 12000, m: 50000, l: 150000, xl: 400000 }
  };

  /* Platform profiles. k = tables at 1 TB (tables ≈ k·TB^0.65); ratios are per table;
     locPer = lines per procedural object; locDay = converted lines per person-day (manual);
     base = inherent migration difficulty 0–1; typical = TB at size "m" by role. */
  const PLATFORMS = {
    mssql: { label: 'SQL Server', short: 'SQL Server', fam: 'db', base: 0.20, k: 600, viewR: 0.35, procR: 0.25, funcR: 0.06, trigR: 0.02, locPer: 180, locDay: 900, schemaF: 0.35, script: 'sqlserver', typical: { edw: 8, mart: 2, ods: 3, oltp: 2, replica: 2 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' },
    synapse: { label: 'Azure Synapse dedicated SQL pool', short: 'Synapse', fam: 'db', base: 0.15, k: 300, viewR: 0.3, procR: 0.2, funcR: 0.03, trigR: 0, locPer: 220, locDay: 1200, schemaF: 0.3, script: null, typical: { edw: 30, mart: 8 }, defRole: 'edw', defDeploy: 'managed', cdc: 'none' },
    oracle: { label: 'Oracle Database', short: 'Oracle', fam: 'db', base: 0.55, k: 500, viewR: 0.4, procR: 0.10, funcR: 0.04, trigR: 0.04, locPer: 700, locDay: 300, schemaF: 1.0, script: 'oracle', typical: { edw: 25, mart: 6, ods: 8, oltp: 5, replica: 5 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' },
    teradata: { label: 'Teradata', short: 'Teradata', fam: 'db', base: 0.65, k: 400, viewR: 0.9, procR: 0.15, funcR: 0.01, trigR: 0.002, locPer: 120, locDay: 400, schemaF: 0.9, script: 'teradata', typical: { edw: 60, mart: 15 }, defRole: 'edw', defDeploy: 'appliance', cdc: 'none' },
    db2luw: { label: 'IBM Db2 for LUW', short: 'Db2 LUW', fam: 'db', base: 0.50, k: 500, viewR: 0.3, procR: 0.08, funcR: 0.03, trigR: 0.02, locPer: 220, locDay: 350, schemaF: 0.9, script: 'db2luw', typical: { edw: 15, mart: 4, ods: 6, oltp: 4, replica: 4 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' },
    db2zos: { label: 'IBM Db2 for z/OS', short: 'Db2 z/OS', fam: 'db', base: 0.85, k: 450, viewR: 0.15, procR: 0.05, funcR: 0.02, trigR: 0.02, locPer: 250, locDay: 250, schemaF: 1.1, script: 'db2zos', typical: { edw: 10, oltp: 8, ods: 6, replica: 6 }, defRole: 'oltp', defDeploy: 'mainframe', cdc: 'possible' },
    db2i: { label: 'IBM Db2 for i (AS/400)', short: 'Db2 for i', fam: 'db', base: 0.60, k: 500, viewR: 0.1, procR: 0.04, funcR: 0.01, trigR: 0.03, locPer: 250, locDay: 300, schemaF: 1.0, script: 'db2i', typical: { oltp: 3, edw: 3, ods: 2, replica: 2 }, defRole: 'oltp', defDeploy: 'onprem', cdc: 'possible' },
    netezza: { label: 'IBM Netezza', short: 'Netezza', fam: 'db', base: 0.50, k: 300, viewR: 0.3, procR: 0.05, funcR: 0.02, trigR: 0, locPer: 200, locDay: 350, schemaF: 0.85, script: null, typical: { edw: 40, mart: 10 }, defRole: 'edw', defDeploy: 'appliance', cdc: 'none' },
    sap_ecc: { label: 'SAP ECC 6.0', short: 'SAP ECC', fam: 'sap_erp', base: 0.80, script: 'sap_erp', typical: { erp: 6 }, defRole: 'erp', defDeploy: 'onprem', cdc: 'possible' },
    sap_s4: { label: 'SAP S/4HANA', short: 'S/4HANA', fam: 'sap_erp', base: 0.70, script: 'sap_erp', typical: { erp: 4 }, defRole: 'erp', defDeploy: 'onprem', cdc: 'possible' },
    sap_bw: { label: 'SAP BW 7.x', short: 'SAP BW', fam: 'sap_bw', base: 0.75, script: 'sap_bw', typical: { edw: 10 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' },
    sap_bw4: { label: 'SAP BW/4HANA', short: 'BW/4HANA', fam: 'sap_bw', base: 0.70, script: 'sap_bw', typical: { edw: 6 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' },
    sap_hana: { label: 'SAP HANA (native / sidecar)', short: 'HANA', fam: 'hana', base: 0.60, k: 400, viewR: 0.2, procR: 0.08, funcR: 0.03, trigR: 0, locPer: 200, locDay: 350, schemaF: 0.9, script: 'hana', typical: { edw: 4, mart: 2 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'none' },
    other: { label: 'Other RDBMS / DW', short: 'Other', fam: 'db', base: 0.50, k: 500, viewR: 0.3, procR: 0.1, funcR: 0.03, trigR: 0.02, locPer: 200, locDay: 300, schemaF: 1.0, script: null, typical: { edw: 10, mart: 3, ods: 4, oltp: 3, replica: 3 }, defRole: 'edw', defDeploy: 'onprem', cdc: 'possible' }
  };
  const PLATFORM_ORDER = ['mssql', 'oracle', 'teradata', 'db2luw', 'db2zos', 'db2i', 'sap_ecc', 'sap_s4', 'sap_bw', 'sap_bw4', 'sap_hana', 'synapse', 'netezza', 'other'];

  /* Fabric-compatibility knowledge: proprietary feature → Fabric approach and gap level */
  const F = (label, gap, fabric, days) => ({ label, gap, fabric, days: days || 0 });
  const FEAT = {
    cursors: F('Cursors', 'medium', 'Fabric Warehouse has no cursors: rewrite row-by-row logic as set-based SQL, or move it to Spark.', 6),
    triggers: F('Triggers', 'high', 'Triggers are not supported in Fabric Warehouse: move the logic into pipelines, stored procedures or the source application.', 8),
    sequences: F('Sequences', 'medium', 'No sequence objects: use IDENTITY columns in Warehouse or ROW_NUMBER()/monotonic IDs in Spark.', 3),
    synonyms: F('Synonyms', 'low', 'Synonyms are not supported: replace them with views or schema-qualified names.', 2),
    linked_servers: F('Linked servers / OPENQUERY', 'medium', 'Replace with OneLake shortcuts, mirroring or pipelines. Cross-database queries work between items in the same workspace.', 5),
    clr: F('CLR assemblies / CLR types', 'high', 'No CLR: rewrite as T-SQL, Spark (Python/Scala) or Fabric user data functions.', 10),
    service_broker: F('Service Broker', 'high', 'Not available: redesign messaging with Eventstream / Real-Time Intelligence or pipelines.', 10),
    xml: F('XML data / FOR XML', 'medium', 'The xml type and FOR XML are not supported in Warehouse: store XML as varchar or convert to JSON, shred it in Spark.', 5),
    spatial: F('Spatial types', 'medium', 'No geography/geometry column type: store latitude/longitude, WKB (varbinary) or WKT (varchar); do spatial work in Spark.', 6),
    temporal: F('Temporal / system-versioned tables', 'medium', 'Rebuild history as SCD Type 2 with MERGE, or with Copy job SCD Type 2 (preview).', 5),
    recursive: F('Recursive queries', 'medium', 'Recursive queries are not supported in Fabric Warehouse: use iterative SQL loops or Spark.', 5),
    mviews: F('Materialized / indexed views', 'medium', 'Materialized views are not supported in Warehouse: persist results as tables refreshed by pipelines, or use Lakehouse materialized lake views.', 5),
    cross_db: F('Cross-database queries', 'low', 'Three-part names work across warehouses and lakehouses in one workspace; design the workspace layout around them.', 2),
    dynamic_sql: F('Dynamic SQL', 'low', 'sp_executesql works in Warehouse procedures; review statements that build object names at run time.', 2),
    agent_jobs: F('SQL Server Agent jobs', 'low', 'Re-create as Fabric pipeline schedules.', 2),
    ssis: F('SSIS packages', 'medium', 'Bridge with the Invoke SSIS Package activity (preview), then re-platform to pipelines / Dataflow Gen2. Check on-premises connectivity and custom components.', 0),
    ssrs: F('SSRS reports', 'low', 'Move to Power BI paginated reports.', 0),
    ssas_tab: F('SSAS Tabular models', 'low', 'Move to Power BI semantic models (Direct Lake where possible).', 0),
    ssas_md: F('SSAS Multidimensional cubes', 'high', 'Rebuild as Power BI semantic models: MDX calculations and actions need redesign in DAX.', 0),
    cdc: F('Change data capture enabled', 'none', 'Mirroring for SQL Server 2016–2022 uses CDC (SQL Server 2025 uses its change feed).', 0),
    always_encrypted: F('Always Encrypted columns', 'medium', 'Not carried over: decrypt inside a controlled pipeline and protect with OneLake security, column-level security and masking.', 4),
    rls: F('Row-level security policies', 'low', 'Re-implement with Warehouse row-level security, OneLake security or semantic-model RLS.', 3),
    ddm: F('Dynamic data masking', 'low', 'Supported in Fabric Warehouse: re-create the masking rules.', 2),
    fulltext: F('Full-text search', 'medium', 'Not available in Warehouse: use Eventhouse (KQL) or Azure AI Search.', 5),
    inmemory: F('In-memory OLTP tables', 'low', 'Not needed for analytics: land as regular Delta tables.', 1),
    unicode: F('nvarchar / nchar columns', 'low', 'Use varchar with a UTF-8 collation; the Migration Assistant converts these automatically.', 1),
    legacy_types: F('datetime / money / tinyint columns', 'low', 'Map to datetime2(6), decimal and smallint.', 1),
    hierarchyid: F('hierarchyid / sql_variant columns', 'medium', 'No equivalent: flatten hierarchies into parent-child columns and split variant columns by type.', 4),
    plsql_packages: F('PL/SQL packages', 'high', 'Convert to T-SQL procedures (Warehouse) or PySpark modules. Package state, overloading and exception blocks need redesign; SSMA for Oracle gives a T-SQL starting point.', 0),
    connect_by: F('CONNECT BY hierarchical queries', 'medium', 'Recursive queries are not supported in Warehouse: flatten hierarchies in Spark or with iterative SQL.', 5),
    autonomous_tx: F('Autonomous transactions', 'medium', 'Redesign logging and audit writes as separate pipeline steps.', 3),
    bulk: F('BULK COLLECT / FORALL', 'low', 'Rewrite as set-based INSERT…SELECT or MERGE.', 2),
    utl: F('UTL_FILE / UTL_HTTP / DBMS_* packages', 'medium', 'Replace with notebooks, pipelines and OneLake file APIs.', 4),
    dblinks: F('Database links', 'medium', 'Replace with mirroring, OneLake shortcuts or pipelines.', 4),
    object_types: F('Object types / collections', 'high', 'No equivalent: flatten to relational tables or JSON and rewrite the logic.', 8),
    number_noprec: F('NUMBER columns without precision', 'medium', 'Define decimal(p,s) explicitly: unconstrained NUMBER columns can fail in Oracle mirroring ("Invalid Decimal Precision or Scale").', 3),
    lobs: F('LOB columns (CLOB / BLOB / LONG)', 'medium', 'varchar(max) and varbinary(max) hold up to 16 MB in Warehouse; keep large documents as files in OneLake.', 3),
    partitioning: F('Table partitioning', 'low', 'Delta tables manage files automatically; revisit partitioning only for very large tables.', 1),
    vpd: F('VPD / row-level policies', 'medium', 'Re-implement with Warehouse RLS, OneLake security or semantic-model RLS.', 5),
    redaction: F('Data redaction', 'low', 'Use dynamic data masking in Warehouse.', 2),
    scheduler: F('Database scheduler jobs', 'low', 'Re-create as pipeline schedules.', 2),
    gtt: F('Global temporary tables', 'low', 'Use session-scoped #temp tables.', 1),
    wrapped: F('Wrapped (obfuscated) PL/SQL', 'high', 'Readable source must be obtained before it can be converted.', 5),
    java: F('Java in the database', 'high', 'Rewrite in Spark (Scala/Java) or notebooks.', 8),
    oracle_text: F('Oracle Text', 'medium', 'Use Eventhouse (KQL) or Azure AI Search.', 5),
    flashback: F('Flashback queries', 'low', 'Use Warehouse time travel or Delta time travel.', 1),
    bteq: F('BTEQ scripts', 'medium', 'Convert to pipelines that call Warehouse procedures or notebooks; .IF ERRORCODE flow control needs redesign.', 0),
    tpt: F('TPT / FastLoad / MultiLoad / FastExport', 'low', 'Replace with Copy job, pipelines, COPY INTO or OneLake file ingestion.', 0),
    macros: F('Macros', 'low', 'Convert to stored procedures or views.', 0),
    spl: F('Stored procedures (SPL)', 'medium', 'Convert to T-SQL stored procedures.', 0),
    qualify: F('QUALIFY clause', 'none', 'Supported natively in Fabric Warehouse T-SQL.', 0),
    set_tables: F('SET tables (duplicate-row elimination)', 'medium', 'Fabric tables keep duplicate rows: add explicit de-duplication to the load logic.', 4),
    period: F('PERIOD types / temporal tables', 'medium', 'Split into begin/end datetime2 columns and rebuild the temporal logic.', 5),
    volatile: F('Volatile / global temporary tables', 'low', 'Use session-scoped #temp tables.', 1),
    join_indexes: F('Join / hash indexes', 'low', 'Not needed in Fabric; recreate as aggregate tables only where queries need them.', 1),
    ppi: F('PPI / columnar partitioning', 'low', 'Delta with V-Order covers this; review clustering for the largest tables.', 1),
    not_casespecific: F('NOT CASESPECIFIC columns', 'medium', 'Fabric Warehouse defaults to a case-sensitive collation: create the warehouse with a case-insensitive collation, or normalize comparisons.', 3),
    json_xml: F('JSON / XML types', 'medium', 'Store JSON as varchar and query it with JSON functions; XML has no equivalent.', 3),
    udfs: F('User-defined functions (C / Java / SQL)', 'medium', 'SQL functions become T-SQL inline functions (scalar UDFs are in preview); C/Java functions move to Spark.', 5),
    tasm: F('TASM / workload management', 'medium', 'Use workload isolation: separate capacities or workspaces, surge protection and workload priorities.', 4),
    querygrid: F('QueryGrid federation', 'medium', 'Use OneLake shortcuts and mirroring for federated access.', 3),
    row_security: F('Row-level security constraints', 'medium', 'Re-implement with Warehouse RLS or OneLake security.', 4),
    sqlpl: F('SQL PL procedures', 'medium', 'Convert to T-SQL procedures; SSMA for Db2 gives a T-SQL starting point.', 0),
    graphic: F('GRAPHIC / VARGRAPHIC / DBCLOB', 'low', 'Map to varchar with a UTF-8 collation.', 1),
    decfloat: F('DECFLOAT columns', 'low', 'Map to decimal or float after checking precision.', 1),
    ts12: F('TIMESTAMP(12) precision', 'low', 'datetime2 keeps 6 fractional digits: confirm the precision loss is acceptable.', 1),
    federation: F('Federation / nicknames', 'medium', 'Replace with OneLake shortcuts or mirroring.', 3),
    rcac: F('RCAC / LBAC security', 'medium', 'Re-implement with row-level security, column-level security and masking.', 5),
    dpf: F('DPF partitions', 'none', 'Not applicable: Fabric scales compute automatically.', 0),
    blu: F('BLU column-organized tables', 'none', 'Not applicable: Delta Parquet is already columnar.', 0),
    external_routines: F('External routines (C / Java / COBOL)', 'high', 'Rewrite in Spark or notebooks.', 8),
    cobol: F('COBOL / PL/I programs with embedded SQL', 'high', 'Applications stay on the mainframe; offload analytics through CDC.', 5),
    ebcdic: F('EBCDIC CCSIDs', 'medium', 'Convert during extraction (connector or CDC tool) and validate special characters.', 4),
    packed: F('Packed / zoned decimal fields', 'medium', 'Db2 connectors convert table columns; flat files need copybook-aware conversion.', 4),
    vsam: F('VSAM / sequential files (copybooks)', 'high', 'Needs copybook-aware conversion (partner tooling) before landing in OneLake.', 10),
    jcl: F('JCL batch', 'medium', 'Orchestrate from Fabric pipelines or keep mainframe scheduling with hand-off triggers.', 4),
    cics_ims: F('CICS / IMS integration', 'high', 'Outside analytics scope: capture the data with CDC or partner tools.', 6),
    racf: F('RACF security', 'medium', 'Map RACF groups to Entra ID groups.', 3),
    dds: F('DDS physical / logical files', 'medium', 'Treat logical files as views; extract with the Db2 connector or partner CDC.', 3),
    rpg: F('RPG / COBOL programs', 'high', 'Business logic stays on IBM i; offload analytics through CDC.', 5),
    journaling: F('Journaling', 'none', 'Enables CDC partners (open mirroring).', 0),
    multimember: F('Multi-member files', 'medium', 'Flatten members into partitions or separate tables.', 3),
    query400: F('Query/400 reports', 'medium', 'Rebuild as Power BI reports.', 0),
    nzplsql: F('NZPLSQL procedures', 'medium', 'Convert to T-SQL procedures or notebooks.', 0),
    zonemaps: F('Zone maps / CBTs', 'none', 'Not needed: Delta statistics and V-Order cover this.', 0),
    distkeys: F('Distribution keys', 'low', 'Not needed: Fabric distributes data automatically.', 1),
    udx: F('UDX (C++)', 'high', 'Rewrite in Spark.', 8),
    nzload: F('nzload / external tables', 'low', 'Replace with Copy job or COPY INTO.', 1),
    calc_views: F('Calculation views', 'high', 'Rebuild as Warehouse views, Spark SQL or semantic models.', 0),
    sqlscript: F('SQLScript procedures', 'medium', 'Convert to T-SQL procedures or PySpark.', 0),
    analytic_priv: F('Analytic privileges', 'high', 'Re-implement as semantic-model RLS / OneLake security.', 6),
    graph: F('HANA graph', 'high', 'Re-implement with Spark (GraphFrames) or a graph service.', 8),
    text_analysis: F('HANA text analysis', 'high', 'Use Fabric AI functions or Azure AI services.', 6),
    pal: F('PAL / APL predictive', 'high', 'Rebuild models with Fabric Data Science (MLflow).', 8),
    sda: F('Smart Data Access virtual tables', 'medium', 'Use OneLake shortcuts or mirroring.', 3),
    nse: F('Native storage extension', 'none', 'Not applicable: OneLake tiering handles cold data.', 0),
    cluster_pool: F('Cluster / pool tables (BSEG, KONV…)', 'medium', 'Read them at the application layer (SAP Datasphere or SAP-certified tools), not with plain database reads.', 4),
    std_extractors: F('Standard extractors (2LIS_*, 0FI_*)', 'medium', 'Replicate with SAP Datasphere replication flows (Mirroring for SAP) or an SAP-certified partner; avoid ODP-RFC for non-SAP targets (SAP Note 3255746).', 4),
    custom_extractors: F('Custom ABAP extractors / function modules', 'high', 'Redesign as CDS views, or replicate base tables and rebuild the logic in Silver/Gold.', 10),
    cds: F('CDS views with extraction', 'low', 'Use extraction-enabled CDS views through Datasphere or certified partners.', 2),
    slt: F('SLT replication', 'medium', 'Use SLT as the source for Datasphere replication or certified partner tools.', 3),
    currency: F('Currency & unit conversion', 'high', 'Rebuild conversion logic (TCURR, T006) in Gold tables or semantic models.', 8),
    hierarchies: F('Hierarchies', 'high', 'Flatten hierarchies into parent-child tables and use DAX PATH functions.', 8),
    texts: F('Multilingual texts', 'medium', 'Model text tables by language and filter by user language in semantic models.', 4),
    sap_auth: F('Analysis authorizations / org-level security', 'high', 'Re-implement as semantic-model RLS or OneLake security with Entra ID groups.', 10),
    custom_z: F('Custom Z tables', 'low', 'Replicate like standard tables.', 1),
    idocs: F('IDocs / BAPIs', 'medium', 'Capture through certified partner tools or event integration.', 4),
    ilm: F('Archived data (ILM)', 'medium', 'Archived history is outside the database: plan a separate historical load.', 5),
    bw_abap: F('ABAP routines in transformations', 'high', 'Rewrite in Spark SQL / PySpark or T-SQL.', 0),
    bex_vars: F('BEx variables & customer exits', 'high', 'Rebuild as Power BI parameters, slicers and DAX.', 6),
    rkf_ckf: F('Restricted / calculated key figures', 'medium', 'Rebuild as DAX measures.', 0),
    noncumulative: F('Non-cumulative key figures (inventory)', 'high', 'Model snapshot facts with semi-additive DAX measures.', 8),
    openhub: F('Open Hub destinations', 'low', 'Replace with direct replication into OneLake.', 1),
    planning: F('Planning (BW-IP / BPC)', 'high', 'Outside Fabric scope: decide on a planning tool separately.', 10),
    mixed: F('Mixed modeling with HANA views', 'medium', 'Rebuild as Gold views or semantic models.', 4),
    composite: F('CompositeProviders', 'medium', 'Rebuild as Gold views or semantic models.', 3),
    generic_procs: F('Stored procedures', 'medium', 'Convert to T-SQL procedures or notebooks.', 0),
    proprietary_sql: F('Proprietary SQL extensions', 'medium', 'Rewrite to T-SQL / Spark SQL.', 4)
  };

  const PLAT_FEATURES = {
    mssql: ['cursors', 'triggers', 'sequences', 'synonyms', 'linked_servers', 'clr', 'service_broker', 'xml', 'spatial', 'temporal', 'recursive', 'mviews', 'cross_db', 'dynamic_sql', 'agent_jobs', 'ssis', 'ssrs', 'ssas_tab', 'ssas_md', 'cdc', 'always_encrypted', 'rls', 'ddm', 'fulltext', 'inmemory', 'unicode', 'legacy_types', 'hierarchyid'],
    synapse: ['mviews', 'dynamic_sql', 'rls', 'ddm', 'unicode', 'legacy_types', 'cross_db'],
    oracle: ['plsql_packages', 'triggers', 'sequences', 'synonyms', 'dblinks', 'mviews', 'connect_by', 'autonomous_tx', 'bulk', 'utl', 'object_types', 'number_noprec', 'lobs', 'xml', 'spatial', 'partitioning', 'vpd', 'redaction', 'scheduler', 'oracle_text', 'flashback', 'gtt', 'wrapped', 'java', 'cursors'],
    teradata: ['bteq', 'tpt', 'macros', 'spl', 'qualify', 'set_tables', 'period', 'volatile', 'join_indexes', 'ppi', 'not_casespecific', 'recursive', 'spatial', 'json_xml', 'udfs', 'row_security', 'tasm', 'querygrid', 'triggers', 'cursors'],
    db2luw: ['sqlpl', 'triggers', 'sequences', 'mviews', 'graphic', 'decfloat', 'ts12', 'xml', 'federation', 'rcac', 'dpf', 'blu', 'external_routines', 'temporal', 'recursive', 'cursors'],
    db2zos: ['cobol', 'sqlpl', 'external_routines', 'triggers', 'sequences', 'ebcdic', 'packed', 'vsam', 'jcl', 'cics_ims', 'mviews', 'temporal', 'racf', 'xml', 'graphic'],
    db2i: ['dds', 'rpg', 'sqlpl', 'triggers', 'journaling', 'multimember', 'ebcdic', 'packed', 'query400'],
    netezza: ['nzplsql', 'zonemaps', 'distkeys', 'mviews', 'udx', 'nzload', 'sequences', 'synonyms'],
    sap_ecc: ['cluster_pool', 'std_extractors', 'custom_extractors', 'cds', 'slt', 'currency', 'hierarchies', 'texts', 'sap_auth', 'custom_z', 'idocs', 'ilm'],
    sap_s4: ['std_extractors', 'custom_extractors', 'cds', 'slt', 'currency', 'hierarchies', 'texts', 'sap_auth', 'custom_z', 'idocs', 'ilm'],
    sap_bw: ['bw_abap', 'bex_vars', 'hierarchies', 'rkf_ckf', 'noncumulative', 'sap_auth', 'openhub', 'planning', 'mixed', 'composite', 'currency'],
    sap_bw4: ['bw_abap', 'bex_vars', 'hierarchies', 'rkf_ckf', 'noncumulative', 'sap_auth', 'openhub', 'planning', 'mixed', 'composite', 'currency'],
    sap_hana: ['calc_views', 'sqlscript', 'analytic_priv', 'spatial', 'graph', 'text_analysis', 'pal', 'sda', 'nse'],
    other: ['generic_procs', 'triggers', 'sequences', 'mviews', 'proprietary_sql', 'udfs']
  };
  /* Features assumed present when a system's feature list is "Not sure" (benchmark defaults) */
  const TYPICAL_FEATURES = {
    mssql: ['cursors', 'dynamic_sql', 'agent_jobs', 'unicode', 'legacy_types', 'cross_db'],
    synapse: ['dynamic_sql', 'unicode'],
    oracle: ['plsql_packages', 'sequences', 'synonyms', 'mviews', 'partitioning', 'number_noprec', 'scheduler', 'cursors'],
    teradata: ['bteq', 'tpt', 'macros', 'qualify', 'set_tables', 'volatile', 'ppi', 'not_casespecific'],
    db2luw: ['sqlpl', 'sequences', 'mviews', 'graphic'],
    db2zos: ['cobol', 'ebcdic', 'packed', 'jcl', 'racf'],
    db2i: ['dds', 'rpg', 'ebcdic', 'packed', 'journaling'],
    netezza: ['nzplsql', 'distkeys', 'zonemaps', 'nzload'],
    sap_ecc: ['cluster_pool', 'std_extractors', 'currency', 'hierarchies', 'texts', 'sap_auth', 'custom_z'],
    sap_s4: ['std_extractors', 'cds', 'currency', 'hierarchies', 'texts', 'sap_auth', 'custom_z'],
    sap_bw: ['bw_abap', 'bex_vars', 'hierarchies', 'rkf_ckf', 'sap_auth', 'currency'],
    sap_bw4: ['bw_abap', 'bex_vars', 'hierarchies', 'rkf_ckf', 'sap_auth', 'composite'],
    sap_hana: ['calc_views', 'sqlscript', 'analytic_priv'],
    other: ['generic_procs', 'proprietary_sql']
  };

  const SAP_MODULE_TABLES = { fi: 90, co: 70, sd: 60, mm: 70, pp: 55, pm: 45, qm: 30, ps: 40, hcm: 70, wm: 35, ewm: 60, tm: 45, crm: 50, is: 60 };
  /* SAP table name → module hints (from the largest tables in discovery output) */
  const SAP_TABLE_HINTS = [
    [/^(ACDOCA|BSEG|BKPF|BSID|BSAD|BSIK|BSAK|BSIS|BSAS|FAGLFLEXA|GLT0|FAGLFLEXT)$/, ['fi']],
    [/^(COEP|COSP|COSS|CE1|CE3|CE4|COBK|ACDOCA)/, ['co']],
    [/^(VBAP|VBAK|VBRP|VBRK|LIPS|LIKP|VBFA|KONV|PRCD_ELEMENTS|VBUP|VBEP)$/, ['sd']],
    [/^(MSEG|MKPF|MATDOC|EKPO|EKKO|EKBE|EBAN|MARD|MBEW|MARC|MARA|EKET)$/, ['mm']],
    [/^(AFPO|AFKO|AFRU|RESB|PLAF|AUFM|AFVC|STPO)$/, ['pp']],
    [/^(QMEL|EQUI|IFLOT|AFIH|MHIS|JEST)$/, ['pm']],
    [/^(QALS|QAMV|QASE|QAVE)$/, ['qm']],
    [/^(PROJ|PRPS|RPSCO)$/, ['ps']],
    [/^(PA\d{4}|PCL[1-4]|HRP1001|HRP1000|PA0001|PA2001|PA2002)$/, ['hcm']],
    [/^(LTAP|LTAK|LQUA|LAGP)$/, ['wm']],
    [/^\/SCWM\//, ['ewm']],
    [/^\/SCMTMS\//, ['tm']]
  ];

  /* Client application signatures (from discovery client_app rows) */
  const APP_SIGNATURES = [
    [/pmdtm|pmserver|informatica|infa_/i, 'etl', 'infa'],
    [/datastage|\bosh\b|dsapi|dscapi/i, 'etl', 'datastage'],
    [/\bodi\b|oracle data integrator/i, 'etl', 'odi'],
    [/talend/i, 'etl', 'talend'],
    [/dtexec|isserverexec|integration services|ssis/i, 'etl', 'ssis'],
    [/al_engine|data services|bods/i, 'etl', 'bods'],
    [/^bteq|tptload|tptupd|tptexp|tptstr|fastload|multload|fastexp|tpump|\btbuild\b/i, 'etl', 'bteq'],
    [/abinitio|ab initio/i, 'etl', 'abinitio'],
    [/azure data factory|datafactory|adf/i, 'etl', 'adf'],
    [/tableau|tabprotosrv/i, 'bi', 'tableau'],
    [/mstr|microstrategy/i, 'bi', 'mstr'],
    [/busobj|webi|wireportserver|businessobjects|\bboe\b|crystal/i, 'bi', 'bo'],
    [/cognos|bibustkservermain/i, 'bi', 'cognos'],
    [/qlik/i, 'bi', 'qlik'],
    [/powerbi|pbidesktop|msmdsrv|mashup|on-premises data gateway/i, 'bi', 'pbi'],
    [/reportingservices|reporting services|ssrs/i, 'bi', 'ssrs'],
    [/nqsserver|obiee|oracle bi|oracle analytics/i, 'bi', 'obiee'],
    [/excel/i, 'bi', 'excel'],
    [/looker/i, 'bi', 'looker'],
    [/\bsas\b|sasexe|sas\.exe/i, 'ds', 'sas'],
    [/python|jupyter|rstudio/i, 'ds', 'notebooks']
  ];

  /* Fabric F SKUs with Power BI / Direct Lake guardrails (Microsoft Learn, verified Nov 2026) */
  const SKUS = [
    { cu: 2, mem: 3, dlRows: 300 }, { cu: 4, mem: 3, dlRows: 300 }, { cu: 8, mem: 3, dlRows: 300 },
    { cu: 16, mem: 5, dlRows: 300 }, { cu: 32, mem: 10, dlRows: 300 }, { cu: 64, mem: 25, dlRows: 1500 },
    { cu: 128, mem: 50, dlRows: 3000 }, { cu: 256, mem: 100, dlRows: 6000 }, { cu: 512, mem: 200, dlRows: 12000 },
    { cu: 1024, mem: 400, dlRows: 24000 }, { cu: 2048, mem: 400, dlRows: 24000 }
  ];

  const DEFAULT_RATES = {
    currency: 'USD', cuHourPayg: 0.18, cuYearReserved: 938, storageGbMonth: 0.023, proUserMonth: 14,
    blendedDayRate: 850, aiConversionFactor: 0.7, contingencyOverride: null, teamFteOverride: null,
    gatewayVmMonth: 450, hoursPerMonth: 730, nonProdHoursMonth: 264
  };

  /* Effort model (person-days). Calibrated to typical enterprise DW migrations; every
     estimate is shown with its drivers so it can be challenged in validation. */
  const EFFORT = {
    mobilize: { base: 10, perSystem: 3 },
    foundation: { base: 15, network: { public: 0, private: 8, isolated: 15 }, cmk: 3, gateway: 4, dr: { none: 0, backup: 2, warm: 6, hot: 12 }, envs: { 1: 0, 2: 2, 3: 5, 4: 8 }, devops: { manual: 10, partial: 6, mature: 3 }, residency: 3 },
    security: { base: 8, rls: { none: 0, basic: 5, complex: 15 }, masking: 4, perReg: 2, catalog: 5, piiExtensive: 6 },
    schema: { perTable: 0.02, perView: 0.05 },
    code: { perObject: 0.2, perTrigger: 1.5 },
    data: { perSystem: 5, perTB: 0.12, mirrorPerSystem: 3, mirrorPerTB: 0.03, bigTable: 4, mainframe: 10 },
    etl: { simple: 0.5, medium: 1.25, complex: 3, scheduler: 5, aiFactor: 0.75, tool: { ssis: 0.7, infa: 1.0, iics: 0.9, datastage: 1.05, talend: 0.95, odi: 1.0, bods: 1.0, slt: 0.6, abinitio: 1.2, bteq: 0.9, adf: 0.35, sproc: 0.8, custom: 1.1, other: 1.0 } },
    bi: { repoint: 0.25, paginated: 0.6, rebuild: 1.5, bexAfo: 1.0, excel: 0.5, model: 5, modelTabular: 2, modelMd: 8, bulkAfter: 500, bulkFactor: 0.6 },
    sap: { perTable: 0.4, perExtractor: 0.6, perCustom: 0.3, perProvider: 1.5, perQuery: 0.5, perChain: 1.0, perTransform: 0.75, semanticBase: 15, datasphereSetup: 10, partnerSetup: 8, calcView: 1.5 },
    validationPct: 0.15, reconFramework: 8, perfPct: 0.06, perfVeryHigh: 5, testPct: 0.15,
    cutover: { perSystem: 5, perParallelWeek: 2, hypercare: 10 }, decom: 3,
    training: { base: 10, perAuthors: 50, sparkGap: 10 }, pmPct: 0.12, archPct: 0.08
  };

  const ROLES = {
    arch: { label: 'Solution / data architect', mult: 1.3 },
    pm: { label: 'Project manager', mult: 1.1 },
    de: { label: 'Fabric data engineer', mult: 1.0 },
    sqle: { label: 'SQL / code conversion engineer', mult: 0.95 },
    bi: { label: 'Power BI developer', mult: 0.95 },
    sap: { label: 'SAP data specialist', mult: 1.35 },
    plat: { label: 'Platform / DevOps engineer', mult: 1.05 },
    sec: { label: 'Security & governance specialist', mult: 1.15 },
    qa: { label: 'Test / QA engineer', mult: 0.8 },
    chg: { label: 'Change & training lead', mult: 0.9 }
  };

  /* Assessment activities: manual baseline effort (days), automation ceiling, dependent sections */
  const ACTIVITIES = [
    { id: 'A1', label: 'Discovery & inventory collection', base: 2, perSystem: 1.5, ceil: 0.92, secs: ['inventory'] },
    { id: 'A2', label: 'Business context & drivers', base: 3, ceil: 0.6, secs: ['org'] },
    { id: 'A3', label: 'Code & object complexity analysis', base: 2, perSystem: 2.5, ceil: 0.88, secs: ['code'] },
    { id: 'A4', label: 'ETL & integration assessment', base: 2, perJobs: 400, ceil: 0.8, secs: ['etl'] },
    { id: 'A5', label: 'BI & consumption assessment', base: 2, perReports: 800, ceil: 0.8, secs: ['bi'] },
    { id: 'A6', label: 'Security & compliance review', base: 2, ceil: 0.7, secs: ['sec'] },
    { id: 'A7', label: 'Fabric compatibility & gap analysis', base: 0, perSystem: 1.5, ceil: 0.92, secs: ['code', 'inventory'] },
    { id: 'A8', label: 'Migration patterns & target architecture', base: 3, perSystem: 1, ceil: 0.85, secs: ['tgt', 'sys'] },
    { id: 'A9', label: 'Capacity sizing & cost model', base: 2, ceil: 0.85, secs: ['workload'] },
    { id: 'A10', label: 'Effort estimation', base: 3, ceil: 0.9, secs: ['*'] },
    { id: 'A11', label: 'Roadmap & wave plan', base: 2, ceil: 0.85, secs: ['ops', 'tgt', 'sys'] },
    { id: 'A12', label: 'Risk register', base: 1.5, ceil: 0.85, secs: ['*'] },
    { id: 'A13', label: 'Report & executive read-out', base: 3, ceil: 0.92, secs: ['*'] }
  ];

  const CONF = { val: 1.0, user: 0.95, disc: 0.95, ai: 0.8, derived: 0.6, default: 0.35, missing: 0 };
  const SOURCE_LABEL = { val: 'Validated', user: 'Provided', disc: 'Discovered', ai: 'AI-extracted', derived: 'Derived', default: 'Benchmark default', missing: 'Missing' };

  /* ---------------- Questionnaire schema ---------------- */
  const SECTIONS = [
    { id: 'org', label: 'Organization & goals', view: 'org' },
    { id: 'etl', label: 'Integration & ETL', view: 'etl' },
    { id: 'bi', label: 'BI & consumption', view: 'bi' },
    { id: 'sec', label: 'Security & compliance', view: 'sec' },
    { id: 'ops', label: 'Operations & team', view: 'ops' },
    { id: 'tgt', label: 'Target preferences', view: 'tgt' }
  ];

  const q = (id, sec, label, type, extra) => Object.assign({ id, sec, label, type, w: 1 }, extra || {});

  const GLOBAL_FIELDS = [
    q('org_name', 'org', 'Client or organization name', 'text', { w: 0, ph: 'e.g. Contoso Retail' }),
    q('org_industry', 'org', 'Industry', 'select', { opts: OPT.industry, w: 2, help: 'Drives compliance and security defaults.' }),
    q('org_size', 'org', 'Organization size', 'select', { opts: OPT.size, w: 3, help: 'The anchor for benchmark estimates when other answers are unknown.' }),
    q('org_region', 'org', 'Primary region', 'select', { opts: OPT.region, w: 1, help: 'Used for data residency and pricing notes.' }),
    q('org_drivers', 'org', 'Business drivers', 'multi', { opts: OPT.drivers, w: 2 }),
    q('org_target_months', 'org', 'Target duration for the migration', 'number', { unit: 'months', min: 1, max: 60, w: 2, help: 'Leave as Not sure to get a recommended timeline.' }),
    q('org_deadline', 'org', 'Hard deadline (licence renewal, support end)', 'month', { w: 1, help: 'Optional. Leave empty if there is no hard date.' }),
    q('org_ms', 'org', 'Microsoft footprint today', 'multi', { opts: OPT.ms, w: 2, help: 'E5 includes Power BI Pro, which changes licensing economics below F64.' }),
    q('org_legacy_cost', 'org', 'Annual run cost of the legacy analytics estate', 'number', { unit: 'per year', money: true, min: 0, w: 0.5, help: 'Licences, support, hardware and hosting. Used for the business case.' }),

    q('etl_tools', 'etl', 'ETL / integration tools in use', 'multi', { opts: OPT.etlTools, w: 3 }),
    q('etl_jobs', 'etl', 'ETL jobs, workflows or packages in scope', 'number', { unit: 'jobs', min: 0, w: 3 }),
    q('etl_mix', 'etl', 'ETL complexity mix', 'select', { opts: OPT.etlMix, w: 2 }),
    q('etl_scheduler', 'etl', 'Scheduler', 'select', { opts: OPT.scheduler, w: 1 }),
    q('etl_feeds', 'etl', 'Upstream sources and feeds (databases, files, APIs)', 'number', { unit: 'feeds', min: 0, w: 1 }),
    q('etl_daily_gb', 'etl', 'Daily new or changed data', 'number', { unit: 'GB / day', min: 0, w: 2 }),
    q('etl_latency', 'etl', 'Freshness required by the business', 'select', { opts: OPT.latency, w: 3 }),
    q('etl_cdc', 'etl', 'Replication / CDC tools in use', 'multi', { opts: OPT.cdcTools, w: 1 }),
    q('etl_window', 'etl', 'Nightly batch window', 'number', { unit: 'hours', min: 0, max: 24, w: 0.5 }),

    q('bi_tools', 'bi', 'BI and reporting tools', 'multi', { opts: OPT.biTools, w: 3 }),
    q('bi_reports', 'bi', 'Reports and dashboards', 'number', { unit: 'reports', min: 0, w: 3 }),
    q('bi_models', 'bi', 'Semantic models, cubes or universes', 'number', { unit: 'models', min: 0, w: 2 }),
    q('bi_viewers', 'bi', 'Report consumers', 'number', { unit: 'users', min: 0, w: 3 }),
    q('bi_authors', 'bi', 'Report authors / self-service creators', 'number', { unit: 'users', min: 0, w: 2 }),
    q('bi_concurrency', 'bi', 'Peak concurrent report users', 'number', { unit: 'users', min: 0, w: 2 }),
    q('bi_unused', 'bi', 'Reports unused in the last 90 days', 'number', { unit: '%', min: 0, max: 100, w: 1, help: 'These can be retired instead of migrated.' }),
    q('bi_paginated', 'bi', 'Pixel-perfect / operational reports', 'number', { unit: '%', min: 0, max: 100, w: 1 }),
    q('bi_ds', 'bi', 'Data science tools', 'multi', { opts: OPT.dsTools, w: 1 }),
    q('bi_ai', 'bi', 'AI ambition', 'select', { opts: OPT.ai, w: 1 }),
    q('bi_embed', 'bi', 'External sharing or embedded analytics', 'select', { opts: OPT.yesno, w: 0.5 }),

    q('sec_regs', 'sec', 'Regulations that apply', 'multi', { opts: OPT.regs, w: 3 }),
    q('sec_pii', 'sec', 'Personal or sensitive data', 'select', { opts: OPT.pii, w: 2 }),
    q('sec_rls', 'sec', 'Row-level security needs', 'select', { opts: OPT.rls, w: 2 }),
    q('sec_masking', 'sec', 'Data masking required', 'select', { opts: OPT.yesno, w: 1 }),
    q('sec_identity', 'sec', 'Identity provider', 'select', { opts: OPT.identity, w: 1 }),
    q('sec_catalog', 'sec', 'Data catalog / lineage', 'multi', { opts: OPT.catalog, w: 1 }),
    q('sec_network', 'sec', 'Network posture', 'select', { opts: OPT.network, w: 2 }),
    q('sec_cmk', 'sec', 'Customer-managed encryption keys required', 'select', { opts: OPT.yesno, w: 1 }),
    q('sec_residency', 'sec', 'Data must stay in a specific country or region', 'select', { opts: OPT.yesno, w: 1 }),

    q('ops_envs', 'ops', 'Environments', 'select', { opts: OPT.envs, w: 1 }),
    q('ops_dr', 'ops', 'Disaster recovery', 'select', { opts: OPT.dr, w: 1 }),
    q('ops_devops', 'ops', 'DevOps maturity', 'select', { opts: OPT.devops, w: 2 }),
    q('ops_skill_sql', 'ops', 'Team SQL skills', 'select', { opts: OPT.skill, w: 1 }),
    q('ops_skill_spark', 'ops', 'Team Spark / Python skills', 'select', { opts: OPT.skill, w: 2 }),
    q('ops_skill_pbi', 'ops', 'Team Power BI skills', 'select', { opts: OPT.skill, w: 1 }),
    q('ops_team_fte', 'ops', 'Internal data team available', 'number', { unit: 'FTE', min: 0, w: 1 }),
    q('ops_delivery', 'ops', 'Delivery model', 'select', { opts: OPT.delivery, w: 0.5 }),

    q('tgt_strategy', 'tgt', 'Migration strategy', 'select', { opts: OPT.strategy, w: 2 }),
    q('tgt_compute', 'tgt', 'Preferred compute', 'select', { opts: OPT.compute, w: 1 }),
    q('tgt_cutover', 'tgt', 'Cutover approach', 'select', { opts: OPT.cutover, w: 1 }),
    q('tgt_parallel_weeks', 'tgt', 'Parallel run before decommissioning', 'number', { unit: 'weeks', min: 0, max: 52, w: 1 }),
    q('tgt_purchase', 'tgt', 'Capacity purchase model', 'select', { opts: OPT.purchase, w: 0.5 }),
    q('tgt_rationalize', 'tgt', 'Retire unused reports and objects during migration', 'select', { opts: OPT.yesno, w: 1 }),
    q('tgt_ai_assist', 'tgt', 'Use AI-assisted code conversion in delivery', 'select', { opts: OPT.yesno, w: 0.5 })
  ];

  const ALL = ['db', 'sap_erp', 'sap_bw', 'hana'];
  const DBH = ['db', 'hana'];
  const SYSTEM_FIELDS = [
    q('s_name', 'sys', 'System name', 'text', { w: 0, fam: ALL }),
    q('s_role', 'sys', 'Role in the estate', 'select', { opts: OPT.role, w: 2, fam: ALL }),
    q('s_version', 'sys', 'Version', 'text', { w: 1, fam: ALL, ph: 'e.g. 19c, 2019, 17.20, ECC 6.0 EHP8' }),
    q('s_deploy', 'sys', 'Deployment', 'select', { opts: OPT.deploy, w: 1, fam: ALL }),
    q('s_scope', 'sys', 'Migration scope', 'select', { opts: OPT.scope, w: 2, fam: ALL }),
    q('s_data_tb', 'inventory', 'Data volume (used, compressed)', 'number', { unit: 'TB', min: 0, step: 0.1, w: 3, fam: ALL }),
    q('s_growth', 'inventory', 'Annual data growth', 'number', { unit: '%', min: 0, max: 300, w: 1, fam: ALL }),
    q('s_db_count', 'inventory', 'Databases / schemas', 'number', { unit: '', min: 0, w: 1, fam: DBH }),
    q('s_tables', 'inventory', 'Tables', 'number', { unit: 'tables', min: 0, w: 3, fam: DBH }),
    q('s_views', 'inventory', 'Views', 'number', { unit: 'views', min: 0, w: 2, fam: DBH }),
    q('s_procs', 'code', 'Stored procedures / packages / macros', 'number', { unit: 'objects', min: 0, w: 3, fam: DBH }),
    q('s_funcs', 'code', 'Functions', 'number', { unit: 'objects', min: 0, w: 1, fam: DBH }),
    q('s_triggers', 'code', 'Triggers', 'number', { unit: 'objects', min: 0, w: 1, fam: DBH }),
    q('s_loc', 'code', 'Lines of procedural code', 'number', { unit: 'lines', min: 0, w: 3, fam: DBH }),
    q('s_code_mix', 'code', 'Procedural code complexity', 'select', { opts: OPT.codeMix, w: 2, fam: DBH }),
    q('s_types', 'code', 'Columns with types needing conversion', 'number', { unit: 'columns', min: 0, w: 1, fam: DBH }),
    q('s_largest_gb', 'inventory', 'Largest table', 'number', { unit: 'GB', min: 0, w: 1, fam: ALL }),
    q('s_features', 'code', 'Proprietary features in use', 'multi', { w: 2, fam: ALL, featureList: true }),
    q('s_cdc', 'sys', 'Change data capture', 'select', { opts: OPT.cdc, w: 1, fam: DBH }),
    q('s_latency', 'sys', 'Freshness needed for this system', 'select', { opts: OPT.latency, w: 1, fam: ALL, help: 'Defaults to the estate-wide answer.' }),
    q('s_users', 'workload', 'Database users / accounts', 'number', { unit: 'users', min: 0, w: 1, fam: ALL }),
    q('s_queries', 'workload', 'Queries per day', 'number', { unit: 'per day', min: 0, w: 2, fam: ALL }),
    q('s_concurrency', 'workload', 'Peak concurrent queries / sessions', 'number', { unit: 'sessions', min: 0, w: 1, fam: ALL }),
    q('s_etl_jobs', 'etl', 'ETL jobs feeding or reading this system', 'number', { unit: 'jobs', min: 0, w: 1, fam: ALL }),
    q('s_reports', 'bi', 'Reports built on this system', 'number', { unit: 'reports', min: 0, w: 1, fam: ALL }),
    q('s_renewal', 'sys', 'Licence / support renewal date', 'month', { w: 0.5, fam: ALL }),

    q('s_sap_db', 'sys', 'Underlying database', 'select', { opts: OPT.sapDb, w: 1, fam: ['sap_erp', 'sap_bw'] }),
    q('s_modules', 'inventory', 'Modules in analytics scope', 'multi', { opts: OPT.sapModules, w: 2, fam: ['sap_erp'] }),
    q('s_sap_tables', 'inventory', 'SAP tables in analytics scope', 'number', { unit: 'tables', min: 0, w: 3, fam: ['sap_erp'] }),
    q('s_sap_extractors', 'inventory', 'DataSources / extractors / CDS views in scope', 'number', { unit: 'objects', min: 0, w: 2, fam: ['sap_erp', 'sap_bw'] }),
    q('s_sap_custom', 'code', 'Custom (Z/Y) objects relevant to analytics', 'number', { unit: 'objects', min: 0, w: 2, fam: ['sap_erp'] }),
    q('s_sap_extract', 'sys', 'How SAP data is extracted today', 'multi', { opts: OPT.sapExtract, w: 3, fam: ['sap_erp', 'sap_bw'] }),
    q('s_datasphere', 'sys', 'SAP Datasphere', 'select', { opts: OPT.datasphere, w: 2, fam: ['sap_erp', 'sap_bw'] }),
    q('s_bdc', 'sys', 'SAP Business Data Cloud', 'select', { opts: OPT.bdc, w: 1, fam: ['sap_erp', 'sap_bw'] }),
    q('s_s4', 'sys', 'S/4HANA program status', 'select', { opts: OPT.s4, w: 2, fam: ['sap_erp'], plats: ['sap_ecc'] }),
    q('s_bw_providers', 'inventory', 'InfoProviders (ADSOs, DSOs, InfoCubes, CompositeProviders)', 'number', { unit: 'providers', min: 0, w: 3, fam: ['sap_bw'] }),
    q('s_bw_queries', 'bi', 'BW / BEx queries', 'number', { unit: 'queries', min: 0, w: 3, fam: ['sap_bw'] }),
    q('s_bw_chains', 'etl', 'Process chains', 'number', { unit: 'chains', min: 0, w: 2, fam: ['sap_bw'] }),
    q('s_bw_transforms', 'code', 'Transformations', 'number', { unit: 'transformations', min: 0, w: 2, fam: ['sap_bw'] }),
    q('s_bw_abap', 'code', 'ABAP routines in transformations', 'select', { opts: OPT.level, w: 2, fam: ['sap_bw'] }),
    q('s_bw_frontend', 'bi', 'BW front ends', 'multi', { opts: OPT.bwFrontend, w: 1, fam: ['sap_bw'] }),
    q('s_hana_calcviews', 'code', 'Calculation views', 'number', { unit: 'views', min: 0, w: 3, fam: ['hana'] }),
    q('s_hana_license', 'sys', 'HANA licence type', 'select', { opts: OPT.hanaLicense, w: 1, fam: ['hana'] })
  ];

  /* Which discovery script each platform uses */
  const SCRIPTS = {
    sqlserver: { file: 'fabric_discovery_sqlserver.sql', label: 'SQL Server', platforms: ['mssql'], tool: 'SSMS or Azure Data Studio', perms: 'VIEW SERVER STATE, VIEW ANY DEFINITION', out: 'Save the result grid as CSV' },
    oracle: { file: 'fabric_discovery_oracle.sql', label: 'Oracle', platforms: ['oracle'], tool: 'SQL*Plus or SQLcl', perms: 'SELECT_CATALOG_ROLE', out: 'Writes fabric_discovery_oracle.csv' },
    teradata: { file: 'fabric_discovery_teradata.bteq', label: 'Teradata', platforms: ['teradata'], tool: 'BTEQ (or Teradata Studio)', perms: 'SELECT on DBC views and DBC.QryLogV', out: 'Writes fabric_discovery_teradata.csv' },
    db2luw: { file: 'fabric_discovery_db2luw.sql', label: 'Db2 LUW', platforms: ['db2luw'], tool: 'Db2 CLP (db2 -x -tf)', perms: 'CONNECT, catalog SELECT, SYSMON', out: 'Writes the file given with -z' },
    db2zos: { file: 'fabric_discovery_db2zos.sql', label: 'Db2 z/OS', platforms: ['db2zos'], tool: 'SPUFI, DSNTEP2 or Data Studio', perms: 'SELECT on the SYSIBM catalog', out: 'Save all result rows to one file' },
    db2i: { file: 'fabric_discovery_db2i.sql', label: 'Db2 for i', platforms: ['db2i'], tool: 'ACS Run SQL Scripts', perms: '*USE on QSYS2 services', out: 'Export results to CSV' },
    sap_erp: { file: 'fabric_discovery_sap_erp_hana.sql', label: 'SAP ECC / S/4HANA', platforms: ['sap_ecc', 'sap_s4'], tool: 'HANA Database Explorer / Studio', perms: 'Read-only user on the ABAP schema (check licence)', out: 'Export the grid as CSV' },
    sap_bw: { file: 'fabric_discovery_sap_bw_hana.sql', label: 'SAP BW / BW/4HANA', platforms: ['sap_bw', 'sap_bw4'], tool: 'HANA Database Explorer / Studio', perms: 'Read-only user on the BW schema (check licence)', out: 'Export each grid as CSV' },
    hana: { file: 'fabric_discovery_hana_native.sql', label: 'SAP HANA native', platforms: ['sap_hana'], tool: 'HANA Database Explorer / Studio', perms: 'CATALOG READ', out: 'Export the grid as CSV' },
    sap_checklist: { file: 'fabric_discovery_sap_checklist.csv', label: 'SAP transaction checklist', platforms: ['sap_ecc', 'sap_s4', 'sap_bw', 'sap_bw4'], tool: 'SAP GUI transactions', perms: 'Basis / BW administrator', out: 'Fill the value column, then import' }
  };

  root.FMA_KB = { OPT, SIZE_MULT, SIZE_BASE, PLATFORMS, PLATFORM_ORDER, FEAT, PLAT_FEATURES, TYPICAL_FEATURES, SAP_MODULE_TABLES, SAP_TABLE_HINTS, APP_SIGNATURES, SKUS, DEFAULT_RATES, EFFORT, ROLES, ACTIVITIES, CONF, SOURCE_LABEL, SECTIONS, GLOBAL_FIELDS, SYSTEM_FIELDS, SCRIPTS, VERSION: '2026.11' };
})(typeof window !== 'undefined' ? window : globalThis);
