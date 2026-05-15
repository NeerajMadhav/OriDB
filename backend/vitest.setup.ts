/** Stable env for unit/integration tests (never require production master password). */
process.env.NODE_ENV = "test";
process.env.ORIDB_MASTER_PASSWORD ??= "oridb-test-master";
