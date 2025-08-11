# Chart Library Migration Sub-Issues

Breaking down #359 into smaller, manageable tasks. Each issue can be completed independently.

## Sub-Issue #1: Setup uPlot and Create Base Wrapper Component
**Effort: Small (2-4 hours)**
**Priority: HIGH**

### Description
Add uPlot dependency and create a reusable React wrapper component that handles uPlot lifecycle.

### Tasks
- [ ] Install uplot package
- [ ] Create `src/components/ui/charts/UPlotChart.tsx` base wrapper
- [ ] Handle proper cleanup on unmount
- [ ] Add responsive sizing support
- [ ] Import and configure uPlot CSS

### Acceptance Criteria
- uPlot is installed and configured
- Base wrapper component properly manages uPlot instance
- No memory leaks on component unmount

---

## Sub-Issue #2: Implement Core Chart Components
**Effort: Medium (4-6 hours)**
**Priority: HIGH**

### Description
Create LineChart, AreaChart, and BarChart components using the uPlot wrapper.

### Tasks
- [ ] Create LineChart component with theme support
- [ ] Create AreaChart component with stacking support
- [ ] Create BarChart component with grouped bars
- [ ] Add consistent prop interfaces matching existing Recharts API where possible
- [ ] Include dark/light theme support

### Acceptance Criteria
- All three chart types render correctly
- Props API is intuitive and consistent
- Theme switching works properly

---

## Sub-Issue #3: Migrate Web Vitals Dashboard Charts
**Effort: Small (2-3 hours)**
**Priority: MEDIUM**

### Description
Replace Recharts in `web-vitals-dashboard.tsx` with new uPlot components.

### Tasks
- [ ] Replace LineChart import and usage
- [ ] Create simple PieChart alternative (canvas-based or CSS)
- [ ] Update data transformation if needed
- [ ] Test with real performance data
- [ ] Verify tooltips and legends work

### Files to Modify
- `src/components/features/monitoring/web-vitals-dashboard.tsx`

### Acceptance Criteria
- Web Vitals dashboard displays correctly with new charts
- Performance metrics are accurately visualized
- No regression in functionality

---

## Sub-Issue #4: Migrate Distribution Charts
**Effort: Medium (3-4 hours)**
**Priority: MEDIUM**

### Description
Replace Recharts in distribution components with uPlot charts.

### Tasks
- [ ] Migrate bar charts in `distribution-charts.tsx`
- [ ] Create donut chart alternative for pie chart
- [ ] Update data formatting for uPlot
- [ ] Ensure click handlers still work

### Files to Modify
- `src/components/features/distribution/distribution-charts.tsx`

### Acceptance Criteria
- Distribution charts render correctly
- Interactive features (clicks, hover) still work
- Visual appearance matches original design

---

## Sub-Issue #5: Handle Complex Visualizations
**Effort: Large (6-8 hours)**
**Priority: LOW**

### Description
Address treemap and other complex visualizations that uPlot doesn't support natively.

### Tasks
- [ ] Evaluate treemap alternatives (keep Nivo for just treemap, or use D3 directly)
- [ ] Implement scatter plot if needed
- [ ] Create heatmap alternative if required
- [ ] Document any visualizations that can't be migrated

### Acceptance Criteria
- Complex visualizations either migrated or documented with alternatives
- Bundle size impact assessed for any retained libraries

---

## Sub-Issue #6: Remove Old Dependencies and Optimize
**Effort: Small (1-2 hours)**
**Priority: LOW**

### Description
Final cleanup - remove Recharts/Nivo and verify bundle size improvements.

### Tasks
- [ ] Remove recharts from package.json
- [ ] Remove @nivo/core and @nivo/treemap if fully migrated
- [ ] Update any remaining imports
- [ ] Run build and measure bundle size
- [ ] Update documentation

### Acceptance Criteria
- Old chart libraries removed from dependencies
- Bundle size reduced by ~550KB
- All charts still functioning
- Build passes without errors

---

## Implementation Order
1. **Start with #1** - Foundation is required for all other work
2. **Then #2** - Core components needed for migrations
3. **#3 and #4 can be done in parallel** - Independent migration tasks
4. **#5 optional** - Only if complex visualizations are critical
5. **#6 last** - Cleanup after migrations complete

## Success Metrics
- Bundle size reduction: Target 550KB+ savings
- Performance: Charts render 10-50x faster
- Memory usage: Reduced memory footprint
- Developer experience: Simpler, more maintainable chart code