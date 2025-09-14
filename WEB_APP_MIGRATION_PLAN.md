# Web App Migration Plan

## Overview
This document outlines which parts of the current Python-based TFSA tracking workflow can be migrated to the web application, and explains the rationale for each decision.

## Current Workflow Analysis

### What's Already in the Web App ✅
- **Portfolio visualization** - Charts, performance tracking, benchmarks
- **Linear contribution calculations** - Mathematical utilities in `/lib/math.ts`
- **Data display** - Reading from JSON/CSV files for timeline and holdings

### What Should Be Migrated to Web App 🚀

#### 1. Trade Recording Interface (High Priority)
**Current:** `ledger_tui.py` - Terminal-based wizard
**Proposed:** Web form interface

**Why migrate:**
- Much better UX than terminal interface
- Form validation and error handling
- Real-time calculations and previews
- Mobile-friendly for on-the-go trade entry
- Integrated with existing portfolio display

**Implementation:**
- Create `/app/trades/record` page
- Form with equity/crypto toggle
- Unit price vs total CAD input options
- Live portfolio impact preview
- Direct database/file updates

#### 2. Holdings Management (High Priority)
**Current:** `apply_trades.py` - Command-line CSV processor
**Proposed:** Integrated web interface

**Why migrate:**
- Eliminate manual CSV management
- Real-time portfolio updates
- Undo/edit capabilities
- Better error handling and validation
- Integrated with trade recording

**Implementation:**
- Move weighted average cost calculations to `/lib/portfolio.ts`
- Create holdings management API routes
- Real-time portfolio recalculation
- Transaction history view

#### 3. Candidate Generation Interface (Medium Priority)
**Current:** `screener_*.py` - Separate Python scripts
**Proposed:** Web-based screener with API backend

**Why migrate:**
- On-demand candidate generation
- Better parameter configuration UI
- Real-time progress indicators
- Integration with LLM workflow
- Historical candidate data storage

**Implementation:**
- API routes for market data fetching
- Progress indicators for long-running operations
- Candidate filtering and sorting UI
- Export to LLM-ready formats

#### 4. LLM Workflow Integration (Medium Priority)
**Current:** Manual copy/paste between files and LLM
**Proposed:** Integrated LLM workflow interface

**Why migrate:**
- Streamlined weekly process
- Built-in prompt templates
- Response parsing and validation
- Trade execution tracking
- Workflow history

**Implementation:**
- `/app/llm-workflow` page
- Candidate data display with copy buttons
- LLM response input and parsing
- Trade recommendation review
- Direct integration with trade recording

### What Should Stay as Python Scripts 🐍

#### 1. Market Data Fetching
**Why keep as Python:**
- Complex API integrations (Yahoo Finance, CoinGecko)
- Rate limiting and retry logic
- Data cleaning and processing
- Better suited for scheduled cron jobs
- Robust error handling for external APIs

#### 2. File Organization Scripts
**Why keep as Python/Bash:**
- Simple dated folder creation
- Integration with existing file structure
- Works well as part of automated pipeline
- No significant UX benefit from web interface

## Implementation Priority

### Phase 1: Core User Experience (Weeks 1-2)
1. **Trade Recording Interface** - Replace `ledger_tui.py`
2. **Holdings Management** - Integrate `apply_trades.py` logic

### Phase 2: Workflow Enhancement (Weeks 3-4)
3. **LLM Workflow Integration** - Streamline weekly process
4. **Basic Candidate Display** - Show existing screener output

### Phase 3: Advanced Features (Weeks 5-6)
5. **Live Candidate Generation** - Web-based screener interface
6. **Workflow Automation** - Reduce manual steps

## Technical Considerations

### Data Storage Migration
- **Current:** CSV files and JSON
- **Proposed:** Keep file-based for simplicity, add database layer later
- **Rationale:** Maintains existing data format, easier migration

### API Design
- RESTful endpoints for portfolio operations
- Real-time updates via server-sent events
- Error handling and validation
- Rate limiting for external API calls

### User Experience
- Progressive enhancement from current workflow
- Maintain ability to use Python scripts as fallback
- Mobile-responsive design for trade entry
- Keyboard shortcuts for power users

## Benefits of Migration

### For Users
- **Faster trade entry** - Web forms vs terminal commands
- **Better visualization** - Real-time portfolio updates
- **Mobile access** - Record trades from anywhere
- **Reduced errors** - Form validation and previews
- **Streamlined workflow** - Integrated LLM process

### For Development
- **Single codebase** - Easier maintenance
- **Better testing** - Web-based integration tests
- **User analytics** - Track usage patterns
- **Easier deployment** - Web-based updates

## Migration Strategy

1. **Incremental approach** - Migrate one component at a time
2. **Maintain compatibility** - Keep Python scripts working during transition
3. **Data validation** - Ensure identical calculations between systems
4. **User testing** - Validate UX improvements with real workflow
5. **Rollback plan** - Ability to revert to Python scripts if needed

## Success Metrics

- **Time savings** - Reduce weekly process time by 50%
- **Error reduction** - Fewer manual calculation mistakes
- **User adoption** - Primary usage shifts to web interface
- **Mobile usage** - Successful trade recording from mobile devices
- **Workflow completion** - End-to-end process in web app