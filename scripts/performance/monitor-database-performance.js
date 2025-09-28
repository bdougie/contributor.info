import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_TOKEN or VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function checkPerformanceMonitoring() {
  console.log(colorize('🔍 Database Performance Monitoring Report', 'bright'));
  console.log('='.repeat(50));
  console.log('');

  try {
    // Check if pg_stat_statements is enabled
    console.log(colorize('📊 Checking pg_stat_statements Extension', 'cyan'));
    const { data: extensions, error: extError } = await supabase
      .from('pg_stat_statements')
      .select('*')
      .limit(1);

    if (extError) {
      console.log(colorize('❌ pg_stat_statements not available or not enabled', 'red'));
      console.log(colorize('   Run the performance monitoring migration first', 'yellow'));
      console.log('');
    } else {
      console.log(colorize('✅ pg_stat_statements extension is enabled', 'green'));
      console.log('');
    }

    // Get slow queries
    console.log(colorize('🐌 Slow Queries Analysis (>500ms)', 'cyan'));
    const { data: slowQueries, error: slowError } = await supabase
      .from('slow_queries')
      .select('*')
      .limit(10);

    if (slowError) {
      console.log(colorize('❌ Unable to fetch slow queries:', 'red'), slowError.message);
    } else if (slowQueries && slowQueries.length > 0) {
      console.log(colorize(`Found ${slowQueries.length} slow queries:`, 'yellow'));
      slowQueries.forEach((query, index) => {
        console.log(`  ${index + 1}. Mean time: ${Math.round(query.mean_exec_time)}ms`);
        console.log(
          `     Calls: ${query.calls}, Cache hit: ${Math.round(query.hit_percent || 0)}%`
        );
        console.log(`     Query: ${query.query.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log(colorize('✅ No slow queries detected', 'green'));
    }
    console.log('');

    // Get connection status
    console.log(colorize('🔗 Connection Pool Status', 'cyan'));
    const { data: connStatus, error: connError } = await supabase.rpc('get_connection_pool_status');

    if (connError) {
      console.log(colorize('❌ Unable to fetch connection status:', 'red'), connError.message);
    } else if (connStatus && connStatus.length > 0) {
      const status = connStatus[0];
      console.log(`Total connections: ${status.total_connections}/${status.max_connections}`);
      console.log(`Active connections: ${status.active_connections}`);
      console.log(`Idle connections: ${status.idle_connections}`);
      console.log(`Utilization: ${status.connection_utilization_percent}%`);

      if (status.connection_utilization_percent > 80) {
        console.log(colorize('⚠️  High connection utilization detected!', 'yellow'));
      } else {
        console.log(colorize('✅ Connection pool healthy', 'green'));
      }
    }
    console.log('');

    // Get database size stats
    console.log(colorize('💾 Database Size Statistics', 'cyan'));
    const { data: sizeStats, error: sizeError } = await supabase.rpc('get_database_size_stats');

    if (sizeError) {
      console.log(colorize('❌ Unable to fetch database size:', 'red'), sizeError.message);
    } else if (sizeStats && sizeStats.length > 0) {
      const stats = sizeStats[0];
      console.log(`Database: ${stats.database_name}`);
      console.log(`Size: ${stats.size_pretty} (${stats.size_bytes} bytes)`);
      console.log(`Tables: ${stats.table_count}`);
      console.log(colorize('✅ Database size information retrieved', 'green'));
    }
    console.log('');

    // Get index usage stats
    console.log(colorize('📈 Index Usage Analysis', 'cyan'));
    const { data: indexStats, error: indexError } = await supabase
      .from('index_usage_stats')
      .select('*')
      .order('idx_scan', { ascending: false })
      .limit(10);

    if (indexError) {
      console.log(colorize('❌ Unable to fetch index statistics:', 'red'), indexError.message);
    } else if (indexStats && indexStats.length > 0) {
      console.log('Top 10 most used indexes:');
      indexStats.forEach((index, i) => {
        console.log(`  ${i + 1}. ${index.tablename}.${index.indexname}`);
        console.log(`     Scans: ${index.idx_scan}, Avg tuples/scan: ${index.avg_tuples_per_scan}`);
        console.log(`     Fetch ratio: ${index.fetch_ratio_percent}%`);
      });
      console.log(colorize('✅ Index usage analysis completed', 'green'));
    } else {
      console.log(colorize('ℹ️  No index usage data available', 'yellow'));
    }
    console.log('');

    // Get table activity stats
    console.log(colorize('📊 Table Activity Statistics', 'cyan'));
    const { data: tableStats, error: tableError } = await supabase
      .from('table_activity_stats')
      .select('*')
      .order('seq_tup_read', { ascending: false })
      .limit(10);

    if (tableError) {
      console.log(colorize('❌ Unable to fetch table statistics:', 'red'), tableError.message);
    } else if (tableStats && tableStats.length > 0) {
      console.log('Most active tables:');
      tableStats.forEach((table, i) => {
        const totalReads = (table.seq_tup_read || 0) + (table.idx_tup_fetch || 0);
        console.log(`  ${i + 1}. ${table.tablename}`);
        console.log(`     Total reads: ${totalReads.toLocaleString()}`);
        console.log(
          `     Inserts: ${table.n_tup_ins}, Updates: ${table.n_tup_upd}, Deletes: ${table.n_tup_del}`
        );
        console.log(`     Live tuples: ${table.n_live_tup}, Dead tuples: ${table.n_dead_tup}`);
      });
      console.log(colorize('✅ Table activity analysis completed', 'green'));
    }
    console.log('');

    // Check for recent performance alerts
    console.log(colorize('🚨 Recent Performance Alerts', 'cyan'));
    const { data: alerts, error: alertError } = await supabase
      .from('query_performance_alerts')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (alertError) {
      console.log(colorize('❌ Unable to fetch performance alerts:', 'red'), alertError.message);
    } else if (alerts && alerts.length > 0) {
      console.log(colorize(`Found ${alerts.length} unresolved alerts:`, 'yellow'));
      alerts.forEach((alert, i) => {
        console.log(`  ${i + 1}. ${alert.alert_type} (${alert.severity})`);
        console.log(`     Value: ${alert.metric_value}, Threshold: ${alert.threshold_value}`);
        console.log(`     Created: ${new Date(alert.created_at).toLocaleString()}`);
        if (alert.details) {
          console.log(`     Details: ${JSON.stringify(alert.details)}`);
        }
      });
    } else {
      console.log(colorize('✅ No unresolved performance alerts', 'green'));
    }
    console.log('');

    // Performance recommendations
    console.log(colorize('💡 Performance Recommendations', 'magenta'));
    console.log('='.repeat(30));

    const recommendations = [];

    if (slowQueries && slowQueries.length > 0) {
      recommendations.push('• Optimize slow queries identified above');
      recommendations.push('• Consider adding indexes for frequently queried columns');
    }

    if (connStatus && connStatus[0]?.connection_utilization_percent > 70) {
      recommendations.push('• Monitor connection pool usage - approaching limits');
      recommendations.push('• Consider implementing connection pooling optimization');
    }

    if (indexStats && indexStats.some((idx) => idx.idx_scan === 0)) {
      recommendations.push('• Remove unused indexes to improve write performance');
    }

    if (tableStats && tableStats.some((table) => table.n_dead_tup > table.n_live_tup * 0.1)) {
      recommendations.push('• Consider running VACUUM on tables with high dead tuple counts');
    }

    if (recommendations.length === 0) {
      console.log(colorize('✅ No immediate performance concerns detected', 'green'));
    } else {
      recommendations.forEach((rec) => console.log(rec));
    }

    console.log('');
    console.log(colorize('📚 For more detailed analysis, check the monitoring views:', 'blue'));
    console.log('  • slow_queries - Queries taking >500ms');
    console.log('  • query_performance_summary - Complete query metrics');
    console.log('  • index_usage_stats - Index effectiveness');
    console.log('  • table_activity_stats - Table operation statistics');
    console.log('  • connection_stats - Real-time connection monitoring');
  } catch (error) {
    console.error(colorize('❌ Error running performance monitoring:', 'red'), error);
  }
}

async function createPerformanceSnapshot() {
  console.log(colorize('📸 Creating Performance Snapshot', 'bright'));
  console.log('='.repeat(30));

  try {
    // Get current performance metrics
    const { data: queryStats } = await supabase.from('query_performance_summary').select('*');

    const { data: connStatus } = await supabase.rpc('get_connection_pool_status');

    const { data: sizeStats } = await supabase.rpc('get_database_size_stats');

    // Calculate metrics
    const totalQueries = queryStats?.reduce((sum, q) => sum + q.calls, 0) || 0;
    const slowQueriesCount = queryStats?.filter((q) => q.mean_exec_time > 500).length || 0;
    const avgQueryTime =
      queryStats?.length > 0
        ? queryStats.reduce((sum, q) => sum + q.mean_exec_time, 0) / queryStats.length
        : 0;
    const maxQueryTime =
      queryStats?.length > 0 ? Math.max(...queryStats.map((q) => q.mean_exec_time)) : 0;
    const avgCacheHitRatio =
      queryStats?.length > 0
        ? queryStats.reduce((sum, q) => sum + (q.cache_hit_ratio || 0), 0) / queryStats.length
        : 0;

    // Insert snapshot
    const { data: snapshot, error } = await supabase
      .from('performance_snapshots')
      .insert({
        total_queries: totalQueries,
        slow_queries_count: slowQueriesCount,
        avg_query_time: avgQueryTime,
        max_query_time: maxQueryTime,
        cache_hit_ratio: avgCacheHitRatio,
        active_connections: connStatus?.[0]?.active_connections || 0,
        database_size_bytes: sizeStats?.[0]?.size_bytes || 0,
      })
      .select()
      .single();

    if (error) {
      console.log(colorize('❌ Failed to create performance snapshot:', 'red'), error.message);
    } else {
      console.log(colorize('✅ Performance snapshot created successfully', 'green'));
      console.log(`Snapshot ID: ${snapshot.id}`);
      console.log(`Total queries: ${totalQueries.toLocaleString()}`);
      console.log(`Slow queries: ${slowQueriesCount}`);
      console.log(`Avg query time: ${Math.round(avgQueryTime)}ms`);
      console.log(`Cache hit ratio: ${Math.round(avgCacheHitRatio)}%`);
      console.log(`Active connections: ${connStatus?.[0]?.active_connections || 0}`);
    }
  } catch (error) {
    console.error(colorize('❌ Error creating performance snapshot:', 'red'), error);
  }
}

async function resetQueryStats() {
  console.log(colorize('🔄 Resetting Query Statistics', 'bright'));
  console.log('='.repeat(30));

  try {
    const { data, error } = await supabase.rpc('reset_query_stats');

    if (error) {
      console.log(colorize('❌ Failed to reset query statistics:', 'red'), error.message);
    } else {
      console.log(colorize('✅ Query statistics reset successfully', 'green'));
      console.log('All pg_stat_statements data has been cleared for fresh monitoring.');
    }
  } catch (error) {
    console.error(colorize('❌ Error resetting query statistics:', 'red'), error);
  }
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'snapshot':
    createPerformanceSnapshot().catch(console.error);
    break;
  case 'reset':
    resetQueryStats().catch(console.error);
    break;
  case 'monitor':
  default:
    checkPerformanceMonitoring().catch(console.error);
    break;
}

export default checkPerformanceMonitoring;
