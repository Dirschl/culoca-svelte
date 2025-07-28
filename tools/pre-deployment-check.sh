#!/bin/bash

# Pre-deployment Database Check Script
# Run this before deploying database changes to production

set -e

echo "🔍 Running pre-deployment database checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-"production"}
DATABASE_URL=${DATABASE_URL:-""}

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable not set${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Environment: $ENVIRONMENT${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo "🔧 Checking required tools..."
if ! command_exists psql; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# 1. Test database connection
echo "🔌 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# 2. Check if functions exist
echo "🔍 Checking required functions..."
REQUIRED_FUNCTIONS=(
    "gallery_items_normal_postgis"
    "gallery_items_unified_postgis"
    "get_images_by_distance_simple"
)

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    if psql "$DATABASE_URL" -t -c "SELECT 1 FROM pg_proc WHERE proname = '$func';" | grep -q 1; then
        echo -e "${GREEN}✅ Function $func exists${NC}"
    else
        echo -e "${RED}❌ Function $func missing${NC}"
        exit 1
    fi
done

# 3. Test function signatures
echo "🧪 Testing function signatures..."
for func in "${REQUIRED_FUNCTIONS[@]}"; do
    echo "Testing $func..."
    
    # Test with sample parameters
    case $func in
        "gallery_items_normal_postgis")
            TEST_PARAMS="user_lat := 0, user_lon := 0, page_value := 0, page_size_value := 1, current_user_id := null"
            ;;
        "gallery_items_unified_postgis")
            TEST_PARAMS="user_lat := 0, user_lon := 0, page_value := 0, page_size_value := 1, current_user_id := null, search_term := null, location_filter_lat := null, location_filter_lon := null"
            ;;
        "get_images_by_distance_simple")
            TEST_PARAMS="filter_lat := 0, filter_lon := 0"
            ;;
    esac
    
    if psql "$DATABASE_URL" -c "SELECT * FROM $func($TEST_PARAMS) LIMIT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $func signature test passed${NC}"
    else
        echo -e "${RED}❌ $func signature test failed${NC}"
        exit 1
    fi
done

# 4. Check function permissions
echo "🔐 Checking function permissions..."
ROLES=("anon" "authenticated" "service_role")

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    for role in "${ROLES[@]}"; do
        if psql "$DATABASE_URL" -t -c "SELECT has_function_privilege('$role', '$func(double precision, double precision, integer, integer, uuid)', 'EXECUTE');" | grep -q t; then
            echo -e "${GREEN}✅ $func executable by $role${NC}"
        else
            echo -e "${RED}❌ $func not executable by $role${NC}"
            exit 1
        fi
    done
done

# 5. Check for data
echo "📊 Checking data availability..."
ITEM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM items WHERE path_512 IS NOT NULL AND gallery = true;" | xargs)
if [ "$ITEM_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $ITEM_COUNT gallery items${NC}"
else
    echo -e "${YELLOW}⚠️  No gallery items found${NC}"
fi

# 6. Check PostGIS extension
echo "🗺️  Checking PostGIS extension..."
if psql "$DATABASE_URL" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'postgis';" | grep -q 1; then
    echo -e "${GREEN}✅ PostGIS extension available${NC}"
else
    echo -e "${RED}❌ PostGIS extension not available${NC}"
    exit 1
fi

# 7. Environment-specific checks
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏭 Running production-specific checks..."
    
    # Check for pending migrations
    if [ -f "database-migrations/pending-migrations.sql" ]; then
        echo -e "${RED}❌ Pending migrations found. Apply migrations before deployment.${NC}"
        exit 1
    fi
    
    # Check for development-only functions
    DEV_FUNCTIONS=$(psql "$DATABASE_URL" -t -c "SELECT proname FROM pg_proc WHERE proname LIKE '%dev%' OR proname LIKE '%test%';")
    if [ ! -z "$DEV_FUNCTIONS" ]; then
        echo -e "${YELLOW}⚠️  Development functions found: $DEV_FUNCTIONS${NC}"
    fi
fi

echo -e "${GREEN}🎉 All pre-deployment checks passed!${NC}"
echo -e "${GREEN}✅ Safe to deploy to $ENVIRONMENT${NC}"

# Optional: Run performance test
if [ "$2" = "--performance" ]; then
    echo "⚡ Running performance test..."
    START_TIME=$(date +%s.%N)
    psql "$DATABASE_URL" -c "SELECT * FROM gallery_items_normal_postgis(0, 0, 0, 10, null);" >/dev/null 2>&1
    END_TIME=$(date +%s.%N)
    DURATION=$(echo "$END_TIME - $START_TIME" | bc)
    echo -e "${GREEN}✅ Performance test completed in ${DURATION}s${NC}"
fi 