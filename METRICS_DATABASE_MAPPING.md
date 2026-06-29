# Metrics Database Mapping - Chatbot Data Access

This document maps all visible metrics on the site to their database storage and calculation methods to ensure the chatbot can fetch everything.

## ✅ USER METRICS (Stored in `users` collection)

### Directly Stored in DB:
- ✅ **XP** → `user.xp` (number)
- ✅ **Gold/Points** → `user.gold` (number)
- ✅ **Level** → `user.level` (number, calculated from XP)
- ✅ **Title** → `user.title` (string)
- ✅ **Display Name** → `user.display_name` (string)
- ✅ **Photo URL** → `user.photo_url` (string)
- ✅ **Badges** → `user.badges` (array)
- ✅ **Reports Submitted** → `user.reports_submitted` (number)
- ✅ **Verifications Made** → `user.verifications_made` (number)
- ✅ **Accurate Verifications** → `user.accurate_verifications` (number)
- ✅ **Trust Score** → `user.trust_score` (number, 0-1 scale)
- ✅ **Contribution Score** → `user.contribution_score` (number)
- ✅ **Unique Wards** → `user.unique_wards` (array)
- ✅ **Unlocked Avatars** → `user.unlocked_avatars` (array)
- ✅ **Quests** → `user.quests` (array of quest objects)

### Calculated Fields:
- ✅ **Level** → Calculated from XP: `Math.floor(Math.sqrt(xp / 50)) + 1`
- ✅ **Accuracy Rate** → `(accurate_verifications / verifications_made) * 100`
- ✅ **Neighbors Helped** → Estimate: `(reports_submitted * 12) + (verifications_made * 4)`
- ✅ **XP Progress** → Current XP vs. XP needed for next level

## ✅ TICKET METRICS (Stored in `tickets` collection)

### Directly Stored:
- ✅ **Priority Score** → `ticket.priority_score` (0-100)
- ✅ **Verification Score** → `ticket.verification_score` (0-100)
- ✅ **Status** → `ticket.status` (reported, verified, in_progress, resolved)
- ✅ **Severity** → `ticket.severity` (low, medium, high, critical)
- ✅ **Category** → `ticket.category` (pothole, water_leak, etc.)
- ✅ **Ward** → `ticket.ward` (ward name)
- ✅ **Department** → `ticket.department` (PWD, Jal Nigam, etc.)
- ✅ **Estimated Cost** → `ticket.estimated_cost` (rupees)
- ✅ **Verification Up** → `ticket.verification_up` (upvote count)
- ✅ **Verification Down** → `ticket.verification_down` (downvote count)
- ✅ **SLA Deadline** → `ticket.sla_deadline` (timestamp)
- ✅ **Root Cause** → `ticket.root_cause` (object with cause, confidence, explanation)
- ✅ **Cluster ID** → `ticket.cluster_id` (string)

### Calculated Fields:
- ✅ **SLA Risk Score** → Calculated from Weibull distribution
- ✅ **Time Remaining** → Current time vs. `sla_deadline`

## ✅ ASSET METRICS (Stored in `assets` collection)

### Directly Stored:
- ✅ **Name** → `asset.name` (string)
- ✅ **Type** → `asset.type` (road, streetlight, water_line, etc.)
- ✅ **Ward** → `asset.ward` (ward name)
- ✅ **Health** → `asset.health` (0-100)
- ✅ **Open Issues Count** → `asset.open_issues_count` (number)

## ✅ DASHBOARD STATS (Calculated in `ticketService.getDashboardStats()`)

### Returned by Backend:
- ✅ **Total Tickets** → `stats.total`
- ✅ **Active Tickets** → `stats.active`
- ✅ **Resolved This Week** → `stats.resolvedThisWeek`
- ✅ **Average Resolution Hours** → `stats.avgResolutionHours`
- ✅ **Active Reporters (Last 7 days)** → `stats.activeReporters`
- ✅ **By Category** → `stats.byCategory` (object)
- ✅ **By Ward** → `stats.byWard` (object)
- ✅ **By Status** → `stats.byStatus` (object)
- ✅ **Department Leaderboard** → `stats.deptLeaderboard` (array)
- ✅ **Ward Health Scores** → `stats.wardHealthScores` (object, ward → health %)
- ✅ **Department Risks** → `stats.departmentRisks` (object, dept → avg priority)
- ✅ **Recurrence Forecasts** → `stats.recurrenceForecasts` (array of risk predictions)

### Calculation Methods:
- **Ward Health Score** → `100 - (avgPriority * 0.5 + activeCount * 2 + verifiedCount * 1.5 + recurrenceCount * 2)`
- **Department Risk** → Average priority score of active tickets in that department
- **Avg Resolution Time** → Average of (resolved_at - created_at) for resolved tickets

## ✅ MISSION METRICS (Stored in `missions` collection)

### Directly Stored:
- ✅ **Title** → `mission.title` (string)
- ✅ **Type** → `mission.type` (hotspot_prediction, duplicate_cluster)
- ✅ **Status** → `mission.status` (active, completed, expired)
- ✅ **Target Confirmations** → `mission.target_confirmations` (number)
- ✅ **Current Confirmations** → `mission.voted_users.length`
- ✅ **XP Reward** → `mission.xp_reward` (number)
- ✅ **Gold Reward** → `mission.gold_reward` (number)
- ✅ **Category** → `mission.category` (pothole, water_leak, etc.)
- ✅ **Ward** → `mission.ward` (ward name)

## ✅ RECURRENCE RISK (Calculated in `math/recurrence.js`)

### Calculated from Historical Data:
- ✅ **Probability** → `risk.probability` (0-1, calculated from Weibull distribution)
- ✅ **Lambda (scale)** → `risk.lambda` (Weibull parameter)
- ✅ **K (shape)** → `risk.k` (Weibull parameter)
- ✅ **Data Points Used** → Number of resolved tickets analyzed
- ✅ **Recommendation** → Text recommendation based on probability

## ✅ CHATBOT CONTEXT (Now Includes)

### User Metrics:
- Level, XP, Gold, Trust Score, Contribution Score
- Reports, Votes, Accurate Votes, Accuracy Rate
- All stored in leaderboard query

### Ticket Metrics:
- Title, Category, Ward, Status, Priority Score, Severity
- Estimated Cost, Root Cause (if available)

### System Metrics:
- Ward Health Scores (all wards with health %)
- Department Risks (all departments with avg priority)
- Average Resolution Time
- Active Reporters Count
- Resolved This Week Count

### Asset Metrics:
- Name, Type, Ward, Health %, Open Issues Count
- Sorted by health (failing assets first)

### Recurrence Forecasts:
- Ward, Category, Probability, Recommended Action

## 🔧 RECENT FIXES

1. ✅ Added `Gold` to leaderboard summary in copilot context
2. ✅ Added `Contribution Score`, `Accurate Verifications`, `Accuracy Rate` to leaderboard
3. ✅ Added Ward Health Scores section to copilot context
4. ✅ Added Department Risk Assessment section to copilot context
5. ✅ Added Average Resolution Time to metrics summary

## 📝 NOTES

- All calculations are done server-side in `ticketService.js` or `userService.js`
- Chatbot gets full context via `copilotRoutes.js`
- Frontend components display data from API responses
- No metrics are calculated only on frontend (except UI-only display formatting)

## ✅ VERIFIED: Chatbot Can Now Fetch

- ✅ User XP, Gold, Level, Trust Score
- ✅ Ward Health Scores
- ✅ Department Risks
- ✅ All ticket metrics (priority, verification, SLA)
- ✅ Asset health data
- ✅ Recurrence forecasts
- ✅ Contribution scores
- ✅ Accuracy rates

**Status: All metrics are now accessible to the chatbot! 🎮**
