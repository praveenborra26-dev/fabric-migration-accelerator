-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : ClickHouse 22.8+ (self-managed or ClickHouse Cloud)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads system.* tables only. No business data is read.
-- Permissions  : SELECT on system tables (default for most users).
-- How to run   : clickhouse-client --host HOST --user USER --password \
--                  --multiquery --ignore-error --format CSV \
--                  < fabric_discovery_clickhouse.sql > fabric_discovery_clickhouse.csv
-- Output       : fabric_discovery_clickhouse.csv -> import it in the accelerator.
-- =============================================================================
SELECT 'platform', 'platform', 'clickhouse';
SELECT 'platform', 'script_version', '2026.11';
SELECT 'platform', 'version', version();
SELECT 'size', 'total_size_gb', toString(round(sum(total_bytes) / pow(1024, 3), 2)) FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema');
SELECT 'size', 'largest_table_gb', toString(round(max(total_bytes) / pow(1024, 3), 2)) FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema');
SELECT 'inventory', 'database_count', toString(count()) FROM system.databases WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema', 'default');
SELECT 'inventory', 'table_count', toString(count()) FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') AND engine NOT IN ('View', 'MaterializedView', 'Dictionary', 'LiveView');
SELECT 'inventory', 'view_count', toString(count()) FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') AND engine = 'View';
SELECT 'inventory', 'mview_count', toString(count()) FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') AND engine = 'MaterializedView';
SELECT 'inventory', 'special_engine_tables', toString(count()) FROM system.tables WHERE database NOT IN ('system') AND engine IN ('ReplacingMergeTree', 'SummingMergeTree', 'AggregatingMergeTree', 'CollapsingMergeTree', 'VersionedCollapsingMergeTree', 'ReplicatedReplacingMergeTree', 'ReplicatedSummingMergeTree', 'ReplicatedAggregatingMergeTree');
SELECT 'inventory', 'kafka_table_count', toString(count()) FROM system.tables WHERE engine IN ('Kafka', 'RabbitMQ', 'NATS');
SELECT 'inventory', 'dictionary_count', toString(count()) FROM system.dictionaries;
SELECT 'inventory', 'function_count', toString(count()) FROM system.functions WHERE origin <> 'System';
SELECT 'types', 'complex_columns', toString(count()) FROM system.columns WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') AND (type LIKE 'Array%' OR type LIKE 'Map%' OR type LIKE 'Nested%' OR type LIKE 'Tuple%' OR type LIKE '%JSON%' OR type LIKE 'AggregateFunction%');
SELECT 'types', 'lowcardinality_columns', toString(count()) FROM system.columns WHERE database NOT IN ('system') AND type LIKE 'LowCardinality%';
SELECT 'workload', 'queries_30d', toString(count()) FROM system.query_log WHERE type = 'QueryFinish' AND event_date >= today() - 30;
SELECT 'workload', 'dbql_days', toString(greatest(dateDiff('day', min(event_date), today()), 1)) FROM system.query_log;
SELECT 'workload', 'peak_hour_queries', toString(max(c)) FROM (SELECT toStartOfHour(event_time) h, count() c FROM system.query_log WHERE type = 'QueryFinish' AND event_date >= today() - 30 GROUP BY h);
SELECT 'workload', 'user_count', toString(count()) FROM system.users;
SELECT 'client_app', replaceAll(if(client_name = '', 'unknown', client_name), ',', ' '), toString(count()) FROM system.query_log WHERE event_date >= today() - 7 GROUP BY 2 ORDER BY count() DESC LIMIT 40;
SELECT 'table_top', replaceAll(database || '.' || name, ',', ' '), toString(round(total_bytes / pow(1024, 3), 3)) || '|' || toString(total_rows) FROM system.tables WHERE database NOT IN ('system') AND total_bytes IS NOT NULL ORDER BY total_bytes DESC LIMIT 25;
