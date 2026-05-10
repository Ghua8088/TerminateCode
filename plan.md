# TerminateCode AI Tools UI Plan

## Goal
Turn TerminateCode into a visible, local-first AI coding command center where the tools the AI uses are as important as the chat itself.

The UI should make three things obvious:
- What the AI is doing.
- Which tool it is using.
- What changed after the tool ran.

## Why This Matters
Right now the AI experience is mostly chat-led. That is useful, but it does not feel like true agentic work unless the app exposes the execution layer:
- terminal commands
- file edits / diffs
- approvals
- background jobs
- tool logs

The desktop app advantage is that we can show all of this in one local workspace instead of hiding it behind a remote chat box.

## Product Direction
The AI side of TerminateCode should become a control room with four visible modes:

1. `Chat`
   - Ask questions, request refactors, and inspect code.
2. `Terminal`
   - Show every command the AI runs, in order, with output and exit status.
3. `Apply`
   - A patch/apply layer that stages changes, previews diffs, and confirms writes.
4. `Tools`
   - A registry of available AI tools, provider adapters, and local automation utilities.

## UI Surfaces To Build

### 1. AI Tools Sidebar
Add a dedicated section in the sidebar for AI execution tools.

It should show:
- active provider
- current mode
- running task count
- approval required count
- recent tool calls

Each tool entry should have:
- name
- short description
- status pill
- last run time
- an icon
- a quick action button

Examples:
- `Terminal Runner`
- `Diff Applier`
- `Repo Indexer`
- `Architecture Mapper`
- `Doc Generator`
- `Refactor Planner`

### 2. Tool Detail Panel
When a tool is selected, the panel should show:
- what the tool does
- what input it expects
- what output it produces
- recent history
- safe/unsafe actions
- retry / cancel / approve controls

This panel should make the AI feel like it is operating real subsystems, not just sending prompts.

### 3. Terminal Event Stream
The terminal must show AI activity live.

Required states:
- command started
- command running
- stdout / stderr
- exit code
- interrupted
- awaiting approval

Each command should include:
- command text
- why it was run
- related tool name
- optional target file or project scope

### 4. Applier Bot View
This is the missing “execution” layer.

The applier UI should show:
- proposed patch summary
- changed files
- diff preview
- apply / reject buttons
- rollback button
- validation status

The user should be able to see exactly what the bot plans to change before anything is written.

### 5. Provider Picker
Support multiple AI runtimes in the UI instead of forcing only raw API key workflows.

The picker should support:
- Claude Code
- Codex
- Gemini CLI
- API-backed models
- local fallback / custom provider

Each provider row should show:
- connection type
- auth method
- whether terminal execution is supported
- whether patch apply is supported

## Tool UX Rules

### Visibility
Every AI action must be visible somewhere in the UI.

### Trust
If a tool writes files or runs commands, the user must be able to approve it first unless it is explicitly marked safe.

### Traceability
Every tool run should create a history entry with:
- timestamp
- input
- output
- files touched
- success / failure state

### Local First
Favor local workspace state over remote state whenever possible.

## Suggested Tool Categories

### Read Tools
- read file
- search file tree
- search semantic memory
- inspect git status
- inspect terminal logs

### Reasoning Tools
- architecture analyzer
- refactor planner
- dependency mapper
- documentation generator

### Write Tools
- patch applier
- file writer
- rename / move assistant
- import fixer

### Runtime Tools
- terminal runner
- test runner
- linter runner
- package builder

## Data Model Sketch

### Tool Record
Each tool should have:
- `id`
- `name`
- `category`
- `description`
- `provider`
- `status`
- `last_run_at`
- `requires_approval`
- `supports_terminal`
- `supports_patch`

### Tool Run Record
Each run should have:
- `id`
- `tool_id`
- `input`
- `output`
- `command`
- `files_changed`
- `exit_code`
- `started_at`
- `finished_at`
- `state`

### Provider Record
Each provider should have:
- `id`
- `name`
- `type`
- `auth_mode`
- `capabilities`
- `is_connected`

## Backend / Frontend Boundaries

### Backend Responsibilities
- run terminal commands
- stream command output
- apply diffs
- track approval gates
- keep tool history
- expose provider capability metadata

### Frontend Responsibilities
- present tool state clearly
- show command / diff / approval surfaces
- manage selection and drill-down
- keep history searchable
- make active tasks obvious at a glance

## Phased Build Plan

### Phase 1: Make AI Actions Visible
- show tool calls in the UI
- add terminal event streaming
- show command metadata
- add a simple run history list

### Phase 2: Add the Applier Bot
- display diff previews
- add approval / deny controls
- apply changes in a controlled step
- support rollback for the last change

### Phase 3: Add Provider Support
- let users choose between Codex / Claude Code / Gemini CLI / API models
- surface provider capability differences
- keep provider state in settings and sidebar

### Phase 4: Make It Feel Agentic
- background agent jobs
- repo memory overlays
- architecture graph integration
- task queues and retries

## Acceptance Criteria
The feature is ready when:
- AI tool usage is visible in the terminal.
- Users can tell which tool is running and why.
- File edits can be previewed before they are applied.
- Provider choice is available in the UI.
- Tool history survives app restarts.
- The sidebar shows active AI execution status at a glance.

## Non-Goals For Now
- building a full remote cloud agent platform
- adding too many providers before the UI flow is stable
- hiding command execution behind a purely chat-based abstraction

## Immediate Next Steps
1. Design the `ToolsPanel` into a real AI tool registry.
2. Add a terminal activity feed for AI-run commands.
3. Build an applier bot panel with diff preview and approval flow.
4. Add provider switching to the sidebar and AI panel.

