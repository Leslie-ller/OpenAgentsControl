#!/usr/bin/env npx ts-node
/**
 * Task Management CLI
 *
 * Usage: npx ts-node task-cli.ts <command> [feature] [args...]
 *
 * Commands:
 *   status [feature]              - Show task status summary
 *   next [feature]                - Show next eligible tasks
 *   parallel [feature]            - Show parallelizable tasks ready to run
 *   deps <feature> <seq>          - Show dependency tree for a task
 *   blocked [feature]             - Show blocked tasks and why
 *   complete <feature> <seq> "summary" - Mark task completed
 *   validate [feature]            - Validate JSON files and dependencies
 *   context [feature]             - Show bounded context breakdown
 *   contracts [feature]           - Show contract dependencies
 *
 * Task files are stored in .tmp/tasks/ at the project root:
 *   .tmp/tasks/{feature-slug}/task.json
 *   .tmp/tasks/{feature-slug}/subtask_01.json
 *   .tmp/tasks/completed/{feature-slug}/
 */

const fs = require('fs');
const path = require('path');

// Line-number validator (inline for CommonJS compatibility)
function validateLineNumberFormat(lines: string | undefined): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!lines || lines.trim() === '') {
    return { valid: true, errors: [] };
  }

  const trimmed = lines.trim();
  const invalidCharsPattern = /[^0-9,\-\s]/;
  if (invalidCharsPattern.test(trimmed)) {
    errors.push(`Invalid characters in line range: "${trimmed}". Only digits, commas, and hyphens are allowed.`);
    return { valid: false, errors, warnings };
  }

  if (trimmed.startsWith(',') || trimmed.endsWith(',')) {
    errors.push(`Line range cannot start or end with a comma: "${trimmed}"`);
  }
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    errors.push(`Line range cannot start or end with a hyphen: "${trimmed}"`);
  }
  if (trimmed.includes(',,')) {
    errors.push(`Line range contains consecutive commas: "${trimmed}"`);
  }
  if (trimmed.includes('--')) {
    errors.push(`Line range contains consecutive hyphens: "${trimmed}"`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const segments = trimmed.split(',');
  for (const segment of segments) {
    const segmentTrimmed = segment.trim();
    if (segmentTrimmed === '') {
      errors.push(`Empty segment in line range: "${trimmed}"`);
      continue;
    }

    if (segmentTrimmed.includes('-')) {
      const parts = segmentTrimmed.split('-');
      if (parts.length !== 2) {
        errors.push(`Invalid range format: "${segmentTrimmed}". Expected format: "start-end"`);
        continue;
      }

      const startStr = parts[0].trim();
      const endStr = parts[1].trim();
      if (startStr === '' || endStr === '') {
        errors.push(`Range has empty start or end: "${segmentTrimmed}"`);
        continue;
      }

      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) {
        errors.push(`Non-numeric values in range: "${segmentTrimmed}"`);
        continue;
      }
      if (start < 1 || end < 1) {
        errors.push(`Line numbers must be positive: "${segmentTrimmed}"`);
        continue;
      }
      if (start > end) {
        errors.push(`Invalid range (start > end): "${segmentTrimmed}". Start must be less than or equal to end.`);
        continue;
      }
      if (start === end) {
        warnings.push(`Range "${segmentTrimmed}" has same start and end. Consider using single line format: "${start}"`);
      }
    } else {
      const lineNum = parseInt(segmentTrimmed, 10);
      if (isNaN(lineNum)) {
        errors.push(`Non-numeric line number: "${segmentTrimmed}"`);
        continue;
      }
      if (lineNum < 1) {
        errors.push(`Line number must be positive: "${segmentTrimmed}"`);
        continue;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Find project root (look for .git or package.json)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const TASKS_DIR = path.join(PROJECT_ROOT, '.tmp', 'tasks');
const COMPLETED_DIR = path.join(TASKS_DIR, 'completed');

// Enhanced schema types
interface ContextFileReference {
  path: string;
  lines?: string;
  reason?: string;
}

interface Contract {
  type: 'api' | 'interface' | 'event' | 'schema';
  name: string;
  path?: string;
  status: 'draft' | 'defined' | 'implemented' | 'verified';
  description?: string;
}

interface DesignComponent {
  type: 'figma' | 'wireframe' | 'mockup' | 'prototype' | 'sketch';
  url?: string;
  path?: string;
  description?: string;
}

interface ADRReference {
  id: string;
  path?: string;
  title?: string;
  decision?: string;
}

interface RICEScore {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  score?: number;
}

interface WSJFScore {
  business_value: number;
  time_criticality: number;
  risk_reduction: number;
  job_size: number;
  score?: number;
}

interface Task {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'blocked' | 'archived';
  objective: string;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  exit_criteria?: string[];
  subtask_count?: number;
  completed_count?: number;
  created_at: string;
  completed_at?: string | null;
  // Enhanced fields
  bounded_context?: string;
  module?: string;
  vertical_slice?: string;
  contracts?: Contract[];
  design_components?: DesignComponent[];
  related_adrs?: ADRReference[];
  rice_score?: RICEScore;
  wsjf_score?: WSJFScore;
  release_slice?: string;
}

interface Subtask {
  id: string;
  seq: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  depends_on?: string[];
  parallel?: boolean;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  acceptance_criteria?: string[];
  deliverables?: string[];
  agent_id?: string | null;
  suggested_agent?: string;
  started_at?: string | null;
  completed_at?: string | null;
  completion_summary?: string | null;
  // Enhanced fields
  bounded_context?: string;
  module?: string;
  vertical_slice?: string;
  contracts?: Contract[];
  design_components?: DesignComponent[];
  related_adrs?: ADRReference[];
}

// Helpers
function getFeatureDirs(): string[] {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f: string) => {
    const fullPath = path.join(TASKS_DIR, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'completed';
  });
}

function loadTask(feature: string): Task | null {
  const taskPath = path.join(TASKS_DIR, feature, 'task.json');
  if (!fs.existsSync(taskPath)) return null;
  return JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
}

function loadSubtasks(feature: string): Subtask[] {
  const featureDir = path.join(TASKS_DIR, feature);
  if (!fs.existsSync(featureDir)) return [];

  const files = fs.readdirSync(featureDir)
    .filter((f: string) => f.match(/^subtask_\d{2}\.json$/))
    .sort();

  return files.map((f: string) => JSON.parse(fs.readFileSync(path.join(featureDir, f), 'utf-8')));
}

function saveSubtask(feature: string, subtask: Subtask): void {
  const subtaskPath = path.join(TASKS_DIR, feature, `subtask_${subtask.seq}.json`);
  fs.writeFileSync(subtaskPath, JSON.stringify(subtask, null, 2));
}

function saveTask(feature: string, task: Task): void {
  const taskPath = path.join(TASKS_DIR, feature, 'task.json');
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
}

// Commands
function cmdStatus(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  if (features.length === 0) {
    console.log('No active features found.');
    return;
  }

  for (const f of features) {
    const task = loadTask(f);
    const subtasks = loadSubtasks(f);

    if (!task) {
      console.log(`\n[${f}] - No task.json found`);
      continue;
    }

    const counts = {
      pending: subtasks.filter(s => s.status === 'pending').length,
      in_progress: subtasks.filter(s => s.status === 'in_progress').length,
      completed: subtasks.filter(s => s.status === 'completed').length,
      blocked: subtasks.filter(s => s.status === 'blocked').length,
    };

    const progress = subtasks.length > 0
      ? Math.round((counts.completed / subtasks.length) * 100)
      : 0;

    console.log(`\n[${f}] ${task.name}`);
    console.log(`  Status: ${task.status} | Progress: ${progress}% (${counts.completed}/${subtasks.length})`);
    console.log(`  Pending: ${counts.pending} | In Progress: ${counts.in_progress} | Completed: ${counts.completed} | Blocked: ${counts.blocked}`);
    
    // Display enhanced metadata if present
    if (task.bounded_context) {
      console.log(`  Bounded Context: ${task.bounded_context}`);
    }
    if (task.module) {
      console.log(`  Module: ${task.module}`);
    }
    if (task.vertical_slice) {
      console.log(`  Vertical Slice: ${task.vertical_slice}`);
    }
    if (task.release_slice) {
      console.log(`  Release: ${task.release_slice}`);
    }
    if (task.rice_score) {
      const score = task.rice_score.score || 
        ((task.rice_score.reach * task.rice_score.impact * (task.rice_score.confidence / 100)) / task.rice_score.effort);
      console.log(`  RICE Score: ${score.toFixed(2)} (R:${task.rice_score.reach} I:${task.rice_score.impact} C:${task.rice_score.confidence}% E:${task.rice_score.effort})`);
    }
    if (task.wsjf_score) {
      const score = task.wsjf_score.score || 
        ((task.wsjf_score.business_value + task.wsjf_score.time_criticality + task.wsjf_score.risk_reduction) / task.wsjf_score.job_size);
      console.log(`  WSJF Score: ${score.toFixed(2)} (BV:${task.wsjf_score.business_value} TC:${task.wsjf_score.time_criticality} RR:${task.wsjf_score.risk_reduction} JS:${task.wsjf_score.job_size})`);
    }
    if (task.contracts && task.contracts.length > 0) {
      console.log(`  Contracts: ${task.contracts.length} (${task.contracts.filter(c => c.status === 'implemented').length} implemented)`);
    }
  }
}

function cmdNext(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Ready Tasks (deps satisfied) ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const ready = subtasks.filter(s => {
      if (s.status !== 'pending') return false;
      return (s.depends_on || []).every(dep => completedSeqs.has(dep));
    });

    if (ready.length > 0) {
      console.log(`[${f}]`);
      for (const s of ready) {
        const parallel = s.parallel ? '[parallel]' : '[sequential]';
        console.log(`  ${s.seq} - ${s.title}  ${parallel}`);
      }
      console.log();
    }
  }
}

function cmdParallel(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Parallelizable Tasks Ready Now ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const parallel = subtasks.filter(s => {
      if (s.status !== 'pending') return false;
      if (!s.parallel) return false;
      return (s.depends_on || []).every(dep => completedSeqs.has(dep));
    });

    if (parallel.length > 0) {
      console.log(`[${f}] - ${parallel.length} parallel tasks:`);
      for (const s of parallel) {
        console.log(`  ${s.seq} - ${s.title}`);
      }
      console.log();
    }
  }
}

function cmdDeps(feature: string, seq: string): void {
  const subtasks = loadSubtasks(feature);
  const target = subtasks.find(s => s.seq === seq);

  if (!target) {
    console.log(`Task ${seq} not found in ${feature}`);
    return;
  }

  console.log(`\n=== Dependency Tree: ${feature}/${seq} ===\n`);
  console.log(`${seq} - ${target.title} [${target.status}]`);

  const depends_on = target.depends_on || [];
  if (depends_on.length === 0) {
    console.log('  └── (no dependencies)');
    return;
  }

  const printDeps = (seqs: string[], indent: string = '  '): void => {
    for (let i = 0; i < seqs.length; i++) {
      const depSeq = seqs[i];
      const dep = subtasks.find(s => s.seq === depSeq);
      const isLast = i === seqs.length - 1;
      const branch = isLast ? '└──' : '├──';

      if (dep) {
        const statusIcon = dep.status === 'completed' ? '✓' : dep.status === 'in_progress' ? '~' : '○';
        console.log(`${indent}${branch} ${statusIcon} ${depSeq} - ${dep.title} [${dep.status}]`);
        const depDeps = dep.depends_on || [];
        if (depDeps.length > 0) {
          const newIndent = indent + (isLast ? '    ' : '│   ');
          printDeps(depDeps, newIndent);
        }
      } else {
        console.log(`${indent}${branch} ? ${depSeq} - NOT FOUND`);
      }
    }
  };

  printDeps(depends_on);
}

function cmdBlocked(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Blocked Tasks ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const blocked = subtasks.filter(s => {
      if (s.status === 'blocked') return true;
      if (s.status !== 'pending') return false;
      return !(s.depends_on || []).every(dep => completedSeqs.has(dep));
    });

    if (blocked.length > 0) {
      console.log(`[${f}]`);
      for (const s of blocked) {
        const waitingFor = (s.depends_on || []).filter(dep => !completedSeqs.has(dep));
        const reason = s.status === 'blocked'
          ? 'explicitly blocked'
          : `waiting: ${waitingFor.join(', ')}`;
        console.log(`  ${s.seq} - ${s.title} (${reason})`);
      }
      console.log();
    }
  }
}

function cmdComplete(feature: string, seq: string, summary: string): void {
  if (summary.length > 200) {
    console.log('Error: Summary must be max 200 characters');
    process.exit(1);
  }

  const subtasks = loadSubtasks(feature);
  const subtask = subtasks.find(s => s.seq === seq);

  if (!subtask) {
    console.log(`Task ${seq} not found in ${feature}`);
    process.exit(1);
    return; // TypeScript guard
  }

  subtask.status = 'completed';
  subtask.completed_at = new Date().toISOString();
  subtask.completion_summary = summary;

  saveSubtask(feature, subtask);

  // Update task.json counts
  const task = loadTask(feature);
  if (task) {
    const newSubtasks = loadSubtasks(feature);
    task.completed_count = newSubtasks.filter(s => s.status === 'completed').length;
    saveTask(feature, task);
  }

  console.log(`\n✓ Marked ${feature}/${seq} as completed`);
  console.log(`  Summary: ${summary}`);

  if (task) {
    console.log(`  Progress: ${task.completed_count}/${task.subtask_count}`);
  }
}

function cmdValidate(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();
  let hasErrors = false;

  console.log('\n=== Validation Results ===\n');

  for (const f of features) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check task.json exists
    const task = loadTask(f);
    if (!task) {
      errors.push('Missing task.json');
    }

    // Load and validate subtasks
    const subtasks = loadSubtasks(f);
    const seqs = new Set(subtasks.map(s => s.seq));

    for (const s of subtasks) {
      // Check ID format
      if (!s.id.startsWith(f)) {
        errors.push(`${s.seq}: ID should start with feature name`);
      }

      // Check for missing dependencies
      for (const dep of (s.depends_on || [])) {
        if (!seqs.has(dep)) {
          errors.push(`${s.seq}: depends on non-existent task ${dep}`);
        }
      }

      // Check for circular dependencies
      const visited = new Set<string>();
      const checkCircular = (seq: string, path: string[]): boolean => {
        if (path.includes(seq)) {
          errors.push(`${s.seq}: circular dependency detected: ${[...path, seq].join(' -> ')}`);
          return true;
        }
        if (visited.has(seq)) return false;
        visited.add(seq);

        const task = subtasks.find(t => t.seq === seq);
        if (task) {
          for (const dep of (task.depends_on || [])) {
            if (checkCircular(dep, [...path, seq])) return true;
          }
        }
        return false;
      };
      checkCircular(s.seq, []);

      // Validate enhanced fields
      if (s.contracts) {
        for (const contract of s.contracts) {
          if (!['api', 'interface', 'event', 'schema'].includes(contract.type)) {
            errors.push(`${s.seq}: invalid contract type "${contract.type}"`);
          }
          if (!['draft', 'defined', 'implemented', 'verified'].includes(contract.status)) {
            errors.push(`${s.seq}: invalid contract status "${contract.status}"`);
          }
        }
      }

      if (s.design_components) {
        for (const comp of s.design_components) {
          if (!['figma', 'wireframe', 'mockup', 'prototype', 'sketch'].includes(comp.type)) {
            errors.push(`${s.seq}: invalid design component type "${comp.type}"`);
          }
        }
      }

      // Validate line-number format in context_files
      if (s.context_files) {
        for (const ref of s.context_files) {
          if (typeof ref !== 'string' && ref.lines) {
            const lineValidation = validateLineNumberFormat(ref.lines);
            if (!lineValidation.valid) {
              for (const error of lineValidation.errors) {
                errors.push(`${s.seq}: context_files line format error: ${error}`);
              }
            }
            if (lineValidation.warnings) {
              for (const warning of lineValidation.warnings) {
                warnings.push(`${s.seq}: context_files line format warning: ${warning}`);
              }
            }
          }
        }
      }

      // Validate line-number format in reference_files
      if (s.reference_files) {
        for (const ref of s.reference_files) {
          if (typeof ref !== 'string' && ref.lines) {
            const lineValidation = validateLineNumberFormat(ref.lines);
            if (!lineValidation.valid) {
              for (const error of lineValidation.errors) {
                errors.push(`${s.seq}: reference_files line format error: ${error}`);
              }
            }
            if (lineValidation.warnings) {
              for (const warning of lineValidation.warnings) {
                warnings.push(`${s.seq}: reference_files line format warning: ${warning}`);
              }
            }
          }
        }
      }

      // Warnings
      if (!(s.acceptance_criteria || []).length) {
        warnings.push(`${s.seq}: No acceptance criteria defined`);
      }
      if (!(s.deliverables || []).length) {
        warnings.push(`${s.seq}: No deliverables defined`);
      }
    }

    // Validate task-level enhanced fields
    if (task) {
      // Validate line-number format in task context_files
      if (task.context_files) {
        for (const ref of task.context_files) {
          if (typeof ref !== 'string' && ref.lines) {
            const lineValidation = validateLineNumberFormat(ref.lines);
            if (!lineValidation.valid) {
              for (const error of lineValidation.errors) {
                errors.push(`task.json: context_files line format error: ${error}`);
              }
            }
            if (lineValidation.warnings) {
              for (const warning of lineValidation.warnings) {
                warnings.push(`task.json: context_files line format warning: ${warning}`);
              }
            }
          }
        }
      }

      // Validate line-number format in task reference_files
      if (task.reference_files) {
        for (const ref of task.reference_files) {
          if (typeof ref !== 'string' && ref.lines) {
            const lineValidation = validateLineNumberFormat(ref.lines);
            if (!lineValidation.valid) {
              for (const error of lineValidation.errors) {
                errors.push(`task.json: reference_files line format error: ${error}`);
              }
            }
            if (lineValidation.warnings) {
              for (const warning of lineValidation.warnings) {
                warnings.push(`task.json: reference_files line format warning: ${warning}`);
              }
            }
          }
        }
      }

      if (task.rice_score) {
        const r = task.rice_score;
        if (r.reach <= 0) errors.push('RICE reach must be > 0');
        if (r.impact < 0.25 || r.impact > 3) errors.push('RICE impact must be 0.25-3');
        if (r.confidence < 0 || r.confidence > 100) errors.push('RICE confidence must be 0-100');
        if (r.effort <= 0) errors.push('RICE effort must be > 0');
      }

      if (task.wsjf_score) {
        const w = task.wsjf_score;
        if (w.business_value < 1 || w.business_value > 10) errors.push('WSJF business_value must be 1-10');
        if (w.time_criticality < 1 || w.time_criticality > 10) errors.push('WSJF time_criticality must be 1-10');
        if (w.risk_reduction < 1 || w.risk_reduction > 10) errors.push('WSJF risk_reduction must be 1-10');
        if (w.job_size < 1 || w.job_size > 10) errors.push('WSJF job_size must be 1-10');
      }

      if (task.contracts) {
        for (const contract of task.contracts) {
          if (!['api', 'interface', 'event', 'schema'].includes(contract.type)) {
            errors.push(`task.json: invalid contract type "${contract.type}"`);
          }
          if (!['draft', 'defined', 'implemented', 'verified'].includes(contract.status)) {
            errors.push(`task.json: invalid contract status "${contract.status}"`);
          }
        }
      }

      // Check counts match
      if (task.subtask_count !== subtasks.length) {
        errors.push(`task.json subtask_count (${task.subtask_count}) doesn't match actual count (${subtasks.length})`);
      }
    }

    // Print results
    console.log(`[${f}]`);
    if (errors.length === 0 && warnings.length === 0) {
      console.log('  ✓ All checks passed');
    } else {
      for (const e of errors) {
        console.log(`  ✗ ERROR: ${e}`);
        hasErrors = true;
      }
      for (const w of warnings) {
        console.log(`  ⚠ WARNING: ${w}`);
      }
    }
    console.log();
  }

  process.exit(hasErrors ? 1 : 0);
}

function cmdContext(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Bounded Context Breakdown ===\n');

  for (const f of features) {
    const task = loadTask(f);
    const subtasks = loadSubtasks(f);

    if (!task) continue;

    console.log(`[${f}] ${task.name}`);
    
    if (task.bounded_context) {
      console.log(`  Bounded Context: ${task.bounded_context}`);
    }
    if (task.module) {
      console.log(`  Module: ${task.module}`);
    }
    if (task.vertical_slice) {
      console.log(`  Vertical Slice: ${task.vertical_slice}`);
    }

    // Group subtasks by bounded context
    const contextGroups = new Map<string, Subtask[]>();
    for (const s of subtasks) {
      const ctx = s.bounded_context || task.bounded_context || 'unspecified';
      if (!contextGroups.has(ctx)) {
        contextGroups.set(ctx, []);
      }
      contextGroups.get(ctx)!.push(s);
    }

    if (contextGroups.size > 1 || (contextGroups.size === 1 && !contextGroups.has('unspecified'))) {
      console.log('\n  Subtasks by Context:');
      for (const [ctx, tasks] of contextGroups) {
        console.log(`    ${ctx}: ${tasks.length} tasks`);
        for (const t of tasks) {
          const status = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '~' : '○';
          console.log(`      ${status} ${t.seq} - ${t.title}`);
        }
      }
    }

    console.log();
  }
}

function cmdContracts(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Contract Dependencies ===\n');

  for (const f of features) {
    const task = loadTask(f);
    const subtasks = loadSubtasks(f);

    if (!task) continue;

    const allContracts: Array<{source: string, contract: Contract}> = [];

    // Collect task-level contracts
    if (task.contracts) {
      for (const c of task.contracts) {
        allContracts.push({ source: 'task', contract: c });
      }
    }

    // Collect subtask-level contracts
    for (const s of subtasks) {
      if (s.contracts) {
        for (const c of s.contracts) {
          allContracts.push({ source: `subtask ${s.seq}`, contract: c });
        }
      }
    }

    if (allContracts.length === 0) {
      console.log(`[${f}] - No contracts defined`);
      continue;
    }

    console.log(`[${f}] ${task.name}`);
    console.log(`  Total Contracts: ${allContracts.length}\n`);

    // Group by type
    const byType = new Map<string, Array<{source: string, contract: Contract}>>();
    for (const item of allContracts) {
      if (!byType.has(item.contract.type)) {
        byType.set(item.contract.type, []);
      }
      byType.get(item.contract.type)!.push(item);
    }

    for (const [type, items] of byType) {
      console.log(`  ${type.toUpperCase()} Contracts (${items.length}):`);
      for (const { source, contract } of items) {
        const statusIcon = contract.status === 'verified' ? '✓' : 
                          contract.status === 'implemented' ? '~' : 
                          contract.status === 'defined' ? '○' : '◌';
        console.log(`    ${statusIcon} ${contract.name} [${contract.status}] (${source})`);
        if (contract.description) {
          console.log(`       ${contract.description}`);
        }
        if (contract.path) {
          console.log(`       Path: ${contract.path}`);
        }
      }
      console.log();
    }
  }
}

// Main
const [,, command, ...args] = process.argv;

switch (command) {
  case 'status':
    cmdStatus(args[0]);
    break;
  case 'next':
    cmdNext(args[0]);
    break;
  case 'parallel':
    cmdParallel(args[0]);
    break;
  case 'deps':
    if (args.length < 2) {
      console.log('Usage: deps <feature> <seq>');
      process.exit(1);
    }
    cmdDeps(args[0], args[1]);
    break;
  case 'blocked':
    cmdBlocked(args[0]);
    break;
  case 'complete':
    if (args.length < 3) {
      console.log('Usage: complete <feature> <seq> "summary"');
      process.exit(1);
    }
    cmdComplete(args[0], args[1], args.slice(2).join(' '));
    break;
  case 'validate':
    cmdValidate(args[0]);
    break;
  case 'context':
    cmdContext(args[0]);
    break;
  case 'contracts':
    cmdContracts(args[0]);
    break;
  default:
    console.log(`
Task Management CLI

Usage: npx ts-node task-cli.ts <command> [feature] [args...]

Task files are stored in: .tmp/tasks/{feature-slug}/

Commands:
  status [feature]                  Show task status summary
  next [feature]                    Show next eligible tasks (deps satisfied)
  parallel [feature]                Show parallelizable tasks ready to run
  deps <feature> <seq>              Show dependency tree for a task
  blocked [feature]                 Show blocked tasks and why
  complete <feature> <seq> "summary" Mark task completed with summary
  validate [feature]                Validate JSON files and dependencies
  context [feature]                 Show bounded context breakdown
  contracts [feature]               Show contract dependencies

Examples:
  npx ts-node task-cli.ts status
  npx ts-node task-cli.ts next my-feature
  npx ts-node task-cli.ts complete my-feature 02 "Implemented auth module"
  npx ts-node task-cli.ts context my-feature
  npx ts-node task-cli.ts contracts my-feature
`);
}
