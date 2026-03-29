# Automated Reporting Configuration

**Purpose:** Set up automated progress reports every 4 hours without user prompting

---

## Cron Schedule (Asia/Bangkok)

| Time | Report Type | Content |
|------|-------------|---------|
| Every 4 hours | Progress Update | Completion %, completed/in-progress/blocked items, agent status |
| 18:00 Daily | Daily Summary | Full day summary, next day plan, key decisions needed |
| On Completion | Final Handoff | Deployment package, credentials, support info |

---

## HEARTBEAT.md Configuration

Add this to `C:\fullstack\inventory-procurement\HEARTBEAT.md`:

```markdown
# SaaS Transition Automated Checks

## Every 4 Hours (Progress Report)
- [ ] Check all subagent session status
- [ ] Collect completed tasks from each agent
- [ ] Update SAAS_EXECUTION_CHECKLIST.md with progress
- [ ] Send progress report to user via message tool

## Daily at 18:00 (Daily Summary)
- [ ] Aggregate all progress from the day
- [ ] Identify blockers and escalations
- [ ] Plan next day priorities
- [ ] Send comprehensive summary to user

## On Task Completion (per subagent)
- [ ] Mark task as complete in checklist
- [ ] Update overall completion percentage
- [ ] Notify orchestrator
- [ ] Trigger next dependent task
```

---

## OpenClaw Cron Job Definitions

### Progress Report Cron (Every 4 Hours)

```json
{
  "label": "saas-progress-report",
  "schedule": {
    "kind": "every",
    "everyMs": 14400000
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Read SAAS_EXECUTION_CHECKLIST.md, collect progress from all active work, update completion percentages, and send formatted progress report to user. Include: overall %, completed ✅, in progress 🚧, blocked ⏸️, next 4h plan, agent status table."
  },
  "delivery": {
    "mode": "announce"
  }
}
```

### Daily Summary Cron (18:00 Daily)

```json
{
  "label": "saas-daily-summary",
  "schedule": {
    "kind": "cron",
    "expr": "0 18 * * *",
    "tz": "Asia/Bangkok"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Generate comprehensive daily summary for SaaS transition. Include: today's accomplishments, metrics (hours worked, tasks completed), blockers requiring user decision, tomorrow's plan, updated timeline projection. Send to user."
  },
  "delivery": {
    "mode": "announce"
  }
}
```

---

## Report Template

```markdown
## 🚀 SaaS Transition Progress Report
**Time:** {timestamp}
**Overall Progress:** {percentage}%

### ✅ Completed (Last 4 Hours)
- {item 1}
- {item 2}

### 🚧 In Progress
- {item 1} ({percentage}%)
- {item 2} ({percentage}%)

### ⏸️ Blocked
- {item} - {reason}
  - **Action Needed:** {what user needs to decide/do}

### 📋 Next 4 Hours
- {planned task 1}
- {planned task 2}

### 📊 Agent Status
| Agent | Status | Progress | ETA |
|-------|--------|----------|-----|
| Database | 🚧 Working | 45% | 2 days |
| Backend | 🚧 Working | 30% | 3 days |
| Frontend | ⏸️ Waiting | 0% | - |
| DevOps | ⏸️ Waiting | 0% | - |
| Security | ⏸️ Waiting | 0% | - |
| Docs | ⏸️ Waiting | 0% | - |

### 📈 Timeline
- **Started:** 2026-03-29
- **Target:** 2026-04-19
- **Days Elapsed:** {n}
- **Days Remaining:** {n}
- **On Track:** ✅ Yes / ⚠️ At Risk / ❌ Behind

---
*Next automatic report: {next_report_time}*
```

---

## Manual Trigger (If Needed)

If automated reporting fails, user can trigger manually by saying:
- "Show SaaS progress"
- "รายงานความคืบหน้า SaaS"
- "How's the SaaS transition going?"

---

## Escalation Triggers

Automatically escalate to user when:
1. **Blocker > 8 hours** - Task blocked for more than 8 hours
2. **Security finding** - Any security vulnerability discovered
3. **Data risk** - Any risk of data loss or leakage
4. **Timeline risk** - Projected completion > 5 days over target
5. **Budget decision** - Any cost/budget decision required
6. **Feature tradeoff** - Need to cut/delay features to meet timeline

---

## Completion Criteria

Project is complete when:
- [x] All 8 phases marked complete in checklist
- [x] All 80 facilities can be onboarded
- [x] Executive dashboard functional
- [x] Security audit passed
- [x] Documentation complete
- [x] Support team trained
- [x] Final handoff package delivered

**Final Action:** Send handoff package with:
1. Deployment guide
2. Admin credentials (secure channel)
3. Support contacts
4. Monitoring dashboard links
5. Training schedule
6. 30-day support commitment
