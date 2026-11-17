# Databricks notebook source
# =============================================================================
# Fabric Migration Assessment Accelerator
# Discovery script : Databricks (Azure, AWS or GCP) with Unity Catalog and/or
#                    the legacy Hive metastore
# Script version   : 2026.11
# -----------------------------------------------------------------------------
# What it does : Reads catalog metadata (information_schema, DESCRIBE DETAIL)
#                and system tables (query history, jobs, billing) if they are
#                enabled. No business data is read. Nothing is created.
# Permissions  : USE CATALOG / USE SCHEMA / SELECT on the catalogs in scope
#                (metadata only), and SELECT on system.query, system.lakeflow
#                and system.billing if you want workload numbers.
# How to run   : Import this file as a notebook (or paste it into a Python
#                cell) and run it on any cluster or serverless compute.
# Output       : A table (section, metric, value). Use the download button
#                under the result to save it as CSV, then import it in the
#                accelerator: Automate -> Discovery scripts.
# Settings     : MAX_DETAIL_TABLES limits how many tables get DESCRIBE DETAIL
#                (size). Set INCLUDE_NAMES = False to omit table names.
# =============================================================================
MAX_DETAIL_TABLES = 3000
INCLUDE_NAMES = True
DAYS = 30

rows = [("platform", "platform", "databricks"), ("platform", "script_version", "2026.11")]

def add(section, metric, value):
    rows.append((section, str(metric).replace(",", " ")[:200], str(value).replace(",", " ")[:500]))

def one(section, metric, sql):
    try:
        v = spark.sql(sql).collect()[0][0]
        add(section, metric, 0 if v is None else v)
    except Exception as e:  # missing system table, privilege, older runtime
        add("error", metric, str(e).splitlines()[0][:300])

def many(section, sql):
    try:
        for r in spark.sql(sql).collect():
            add(section, r[0], r[1])
    except Exception as e:
        add("error", section, str(e).splitlines()[0][:300])

try:
    add("platform", "version", spark.conf.get("spark.databricks.clusterUsageTags.sparkVersion", spark.version))
except Exception:
    add("platform", "version", spark.version)
try:
    add("platform", "cloud", spark.conf.get("spark.databricks.cloudProvider", "unknown"))
except Exception:
    pass

# ---- Unity Catalog inventory -------------------------------------------------
UC_FILTER = "table_catalog NOT IN ('system', 'samples', '__databricks_internal') AND table_schema <> 'information_schema'"
one("inventory", "database_count", "SELECT COUNT(*) FROM system.information_schema.catalogs WHERE catalog_name NOT IN ('system', 'samples', '__databricks_internal')")
one("inventory", "schema_count", "SELECT COUNT(*) FROM system.information_schema.schemata WHERE catalog_name NOT IN ('system', 'samples', '__databricks_internal') AND schema_name <> 'information_schema'")
one("inventory", "table_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type IN ('MANAGED', 'EXTERNAL', 'FOREIGN')")
one("inventory", "view_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type = 'VIEW'")
one("inventory", "mview_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type = 'MATERIALIZED_VIEW'")
one("inventory", "streaming_table_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type = 'STREAMING_TABLE'")
one("inventory", "external_table_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type = 'EXTERNAL'")
one("inventory", "foreign_table_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type = 'FOREIGN'")
one("inventory", "non_delta_table_count", f"SELECT COUNT(*) FROM system.information_schema.tables WHERE {UC_FILTER} AND table_type IN ('MANAGED', 'EXTERNAL') AND UPPER(COALESCE(data_source_format, 'DELTA')) <> 'DELTA'")
one("inventory", "function_count", "SELECT COUNT(*) FROM system.information_schema.routines WHERE specific_catalog NOT IN ('system', 'samples') AND specific_schema <> 'information_schema'")
one("code", "python_function_count", "SELECT COUNT(*) FROM system.information_schema.routines WHERE specific_catalog NOT IN ('system', 'samples') AND UPPER(COALESCE(external_language, '')) = 'PYTHON'")
one("security", "rls_policy_count", f"SELECT COUNT(*) FROM system.information_schema.row_filters WHERE table_catalog NOT IN ('system', 'samples')")
one("security", "masked_column_count", f"SELECT COUNT(*) FROM system.information_schema.column_masks WHERE table_catalog NOT IN ('system', 'samples')")

# ---- data types ---------------------------------------------------------------
many("types", f"""SELECT CASE WHEN data_type LIKE 'STRUCT%' OR data_type LIKE 'ARRAY%' OR data_type LIKE 'MAP%' THEN 'nested_columns'
                              WHEN data_type = 'VARIANT' THEN 'variant_columns'
                              WHEN data_type LIKE 'INTERVAL%' THEN 'interval_columns' END AS m, COUNT(*)
                  FROM system.information_schema.columns
                  WHERE table_catalog NOT IN ('system', 'samples', '__databricks_internal') AND table_schema <> 'information_schema'
                    AND (data_type LIKE 'STRUCT%' OR data_type LIKE 'ARRAY%' OR data_type LIKE 'MAP%' OR data_type = 'VARIANT' OR data_type LIKE 'INTERVAL%')
                  GROUP BY 1""")

# ---- sizes (DESCRIBE DETAIL on Delta tables) -----------------------------------
total_bytes = 0; sized = 0; tops = []
try:
    tbls = spark.sql(f"""SELECT table_catalog, table_schema, table_name FROM system.information_schema.tables
                         WHERE {UC_FILTER} AND table_type IN ('MANAGED', 'EXTERNAL')
                           AND UPPER(COALESCE(data_source_format, 'DELTA')) = 'DELTA' LIMIT {MAX_DETAIL_TABLES}""").collect()
except Exception as e:
    tbls = []; add("error", "uc_tables", str(e).splitlines()[0][:300])
try:  # legacy Hive metastore tables, if any
    for db in spark.sql("SHOW DATABASES IN hive_metastore").collect():
        for t in spark.sql(f"SHOW TABLES IN hive_metastore.`{db[0]}`").collect():
            if not t.isTemporary and len(tbls) < MAX_DETAIL_TABLES:
                tbls.append(("hive_metastore", db[0], t.tableName))
    add("inventory", "hive_metastore_tables", sum(1 for t in tbls if t[0] == "hive_metastore"))
except Exception as e:
    add("error", "hive_metastore", str(e).splitlines()[0][:300])
for c, s, t in tbls:
    try:
        d = spark.sql(f"DESCRIBE DETAIL `{c}`.`{s}`.`{t}`").collect()[0]
        b = d["sizeInBytes"] or 0
        total_bytes += b; sized += 1
        tops.append((f"{c}.{s}.{t}", b, d["numFiles"]))
    except Exception:
        pass
add("size", "total_size_gb", round(total_bytes / 1024**3, 2))
add("size", "tables_sized", sized)
if tops:
    tops.sort(key=lambda x: -x[1])
    add("size", "largest_table_gb", round(tops[0][1] / 1024**3, 2))
    for name, b, files in tops[:25]:
        add("table_top", name if INCLUDE_NAMES else "table", f"{round(b / 1024**3, 3)}|")

# ---- workload and jobs (system tables, if enabled) -----------------------------
one("workload", "queries_30d", f"SELECT COUNT(*) FROM system.query.history WHERE start_time >= current_timestamp() - INTERVAL {DAYS} DAYS")
add("workload", "dbql_days", DAYS)
one("workload", "peak_hour_queries", f"SELECT MAX(c) FROM (SELECT date_trunc('hour', start_time) h, COUNT(*) c FROM system.query.history WHERE start_time >= current_timestamp() - INTERVAL {DAYS} DAYS GROUP BY 1)")
one("workload", "user_count", f"SELECT COUNT(DISTINCT executed_by) FROM system.query.history WHERE start_time >= current_timestamp() - INTERVAL {DAYS} DAYS")
one("workload", "dbu_30d", f"SELECT ROUND(SUM(usage_quantity), 1) FROM system.billing.usage WHERE usage_date >= current_date() - INTERVAL {DAYS} DAYS AND usage_unit = 'DBU'")
one("etl", "scheduler_jobs", "SELECT COUNT(DISTINCT job_id) FROM system.lakeflow.jobs WHERE delete_time IS NULL")
one("etl", "pipeline_count", "SELECT COUNT(DISTINCT pipeline_id) FROM system.lakeflow.pipelines WHERE delete_time IS NULL")
one("code", "ml_model_count", "SELECT COUNT(*) FROM system.information_schema.registered_models")
many("client_app", f"SELECT COALESCE(client_application, 'unknown'), COUNT(*) FROM system.query.history WHERE start_time >= current_timestamp() - INTERVAL {DAYS} DAYS GROUP BY 1 ORDER BY 2 DESC LIMIT 40")

result = spark.createDataFrame(rows, "section string, metric string, value string")
display(result)
print("\n".join(",".join(r) for r in rows))
