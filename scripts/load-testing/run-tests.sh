#!/bin/bash

# Load Testing Runner Script
# Runs all k6 load tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESULTS_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="${RESULTS_DIR}/${TIMESTAMP}"

# Create results directory
mkdir -p "${REPORT_DIR}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v k6 &> /dev/null; then
        print_error "k6 is not installed!"
        echo "Install k6 using: brew install k6 (macOS) or see https://k6.io/docs/getting-started/installation"
        exit 1
    fi

    if [ -z "$VITE_SUPABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
        print_warning "SUPABASE_URL not set. Tests will use default URL."
    fi

    if [ -z "$VITE_SUPABASE_ANON_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
        print_error "SUPABASE_ANON_KEY not set!"
        echo "Please set VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable"
        exit 1
    fi

    print_status "Dependencies check passed ✓"
}

# Function to run a single test
run_test() {
    local test_file=$1
    local test_name=$2
    local output_file="${REPORT_DIR}/${test_name}.json"

    print_status "Running ${test_name}..."

    if k6 run \
        -e SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}" \
        -e SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-$VITE_SUPABASE_ANON_KEY}" \
        -e VERBOSE="${VERBOSE:-false}" \
        --summary-export="${output_file}" \
        --out json="${REPORT_DIR}/${test_name}_raw.json" \
        "${test_file}"; then
        print_status "${test_name} completed successfully ✓"
        return 0
    else
        print_error "${test_name} failed!"
        return 1
    fi
}

# Function to generate HTML report
generate_html_report() {
    print_status "Generating HTML report..."

    cat > "${REPORT_DIR}/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 30px;
            text-align: center;
        }
        .test-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-card h2 {
            color: #34495e;
            margin-bottom: 15px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric {
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #3498db;
        }
        .metric-label {
            font-size: 0.9em;
            color: #7f8c8d;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .status-pass {
            color: #27ae60;
        }
        .status-fail {
            color: #e74c3c;
        }
        .status-warning {
            color: #f39c12;
        }
        .summary {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }
        .timestamp {
            text-align: center;
            color: #7f8c8d;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Load Test Report</h1>
        <div class="timestamp">Generated: <span id="timestamp"></span></div>
        <div id="test-results"></div>
        <div class="summary">
            <h3>Overall Summary</h3>
            <div id="overall-summary"></div>
        </div>
    </div>
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();

        // Load test results
        const tests = [
            { name: 'Sustained Load', file: '01-sustained-load.json' },
            { name: 'Burst Traffic', file: '02-burst-traffic.json' },
            { name: 'Concurrent Connections', file: '03-concurrent-connections.json' },
            { name: 'Circuit Breaker', file: '04-circuit-breaker.json' },
            { name: 'Stress Test', file: '05-stress-test.json' }
        ];

        // Display placeholder
        document.getElementById('test-results').innerHTML = '<p>Loading test results...</p>';
    </script>
</body>
</html>
EOF

    print_status "HTML report generated at: ${REPORT_DIR}/index.html"
}

# Main execution
main() {
    echo "========================================="
    echo "     Load Testing Suite for Edge Functions"
    echo "========================================="
    echo

    # Check dependencies
    check_dependencies

    # Display test plan
    print_status "Test Plan:"
    echo "  1. Sustained Load Test (100 req/s for 5 min)"
    echo "  2. Burst Traffic Test (1000 req in 10s)"
    echo "  3. Concurrent Connections Test (50 simultaneous)"
    echo "  4. Circuit Breaker Test (Failover validation)"
    echo "  5. Stress Test (Gradual load increase)"
    echo

    # Ask for confirmation
    read -p "Do you want to run all tests? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Tests cancelled."
        exit 0
    fi

    # Run tests
    local failed_tests=0

    if [ "${RUN_SUSTAINED:-true}" = "true" ]; then
        run_test "01-sustained-load.js" "01-sustained-load" || ((failed_tests++))
    fi

    if [ "${RUN_BURST:-true}" = "true" ]; then
        run_test "02-burst-traffic.js" "02-burst-traffic" || ((failed_tests++))
    fi

    if [ "${RUN_CONCURRENT:-true}" = "true" ]; then
        run_test "03-concurrent-connections.js" "03-concurrent-connections" || ((failed_tests++))
    fi

    if [ "${RUN_CIRCUIT:-true}" = "true" ]; then
        run_test "04-circuit-breaker.js" "04-circuit-breaker" || ((failed_tests++))
    fi

    if [ "${RUN_STRESS:-true}" = "true" ]; then
        print_warning "Stress test will take ~30 minutes. Consider running separately."
        read -p "Run stress test? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_test "05-stress-test.js" "05-stress-test" || ((failed_tests++))
        fi
    fi

    # Generate report
    generate_html_report

    # Summary
    echo
    echo "========================================="
    if [ $failed_tests -eq 0 ]; then
        print_status "All tests completed successfully! ✅"
    else
        print_warning "${failed_tests} test(s) failed. Check logs for details."
    fi
    echo "Reports saved to: ${REPORT_DIR}"
    echo "========================================="

    # Open report in browser (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "${REPORT_DIR}/index.html"
    fi
}

# Run main function
main "$@"