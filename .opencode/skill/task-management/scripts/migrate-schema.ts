#!/usr/bin/env npx ts-node
/**
 * Task Schema Migration Script
 * 
 * Migrates task.json and subtask_NN.json files from base schema to enhanced schema.
 * Supports line-number precision, domain modeling, contracts, ADRs, and prioritization.
 * 
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' migrate-schema.ts --task <feature-name>
 *   npx ts-node --compiler-options '{"module":"commonjs"}' migrate-schema.ts --all
 *   npx ts-node --compiler-options '{"module":"commonjs"}' migrate-schema.ts --task <feature> --dry-run
 *   npx ts-node --compiler-options '{"module":"commonjs"}' migrate-schema.ts --task <feature> --lines-only
 *   npx ts-node --compiler-options '{"module":"commonjs"}' migrate-schema.ts --task <feature> --add-domain --bounded-context auth
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// TYPES
// ============================================================================

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

interface BaseTask {
  id: string;
  name: string;
  status: string;
  objective: string;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  exit_criteria?: string[];
  subtask_count?: number;
  completed_count?: number;
  created_at: string;
  completed_at?: string;
}

interface EnhancedTask extends BaseTask {
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

interface BaseSubtask {
  id: string;
  seq: string;
  title: string;
  status: string;
  depends_on?: string[];
  parallel?: boolean;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  suggested_agent?: string;
  acceptance_criteria?: string[];
  deliverables?: string[];
  agent_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  completion_summary?: string | null;
}

interface EnhancedSubtask extends BaseSubtask {
  bounded_context?: string;
  module?: string;
  vertical_slice?: string;
  contracts?: Contract[];
  design_components?: DesignComponent[];
  related_adrs?: ADRReference[];
}

interface MigrationOptions {
  task?: string;
  all?: boolean;
  dryRun?: boolean;
  linesOnly?: boolean;
  addDomain?: boolean;
  boundedContext?: string;
  module?: string;
  verticalSlice?: string;
  releaseSlice?: string;
}

interface MigrationResult {
  file: string;
  status: 'migrated' | 'skipped' | 'error';
  changes: string[];
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TASKS_DIR = path.join(process.cwd(), '.tmp', 'tasks');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a file exists
 */
const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};

/**
 * Read JSON file
 */
const readJSON = <T>(filePath: string): T => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
};

/**
 * Write JSON file with formatting
 */
const writeJSON = (filePath: string, data: unknown): void => {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
};

/**
 * Get all task directories
 */
const getTaskDirectories = (): string[] => {
  if (!fileExists(TASKS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(TASKS_DIR)
    .filter(name => {
      const fullPath = path.join(TASKS_DIR, name);
      return fs.statSync(fullPath).isDirectory() && name !== 'completed';
    });
};

/**
 * Get all subtask files for a task
 */
const getSubtaskFiles = (taskDir: string): string[] => {
  return fs.readdirSync(taskDir)
    .filter(name => name.startsWith('subtask_') && name.endsWith('.json'))
    .map(name => path.join(taskDir, name));
};

/**
 * Check if context_files is already in enhanced format
 */
const isEnhancedFormat = (contextFiles?: (string | ContextFileReference)[]): boolean => {
  if (!contextFiles || contextFiles.length === 0) {
    return false;
  }
  
  return contextFiles.some(ref => typeof ref === 'object' && 'path' in ref);
};

/**
 * Convert string array to enhanced format with line-number precision
 */
const convertToEnhancedFormat = (
  files: (string | ContextFileReference)[] | undefined,
  isContextFile: boolean
): ContextFileReference[] | undefined => {
  if (!files || files.length === 0) {
    return undefined;
  }
  
  return files.map(ref => {
    if (typeof ref === 'string') {
      // Convert string to object format
      const fileSize = getFileSize(ref);
      const shouldAddLines = fileSize > 100; // Add line ranges for files >100 lines
      
      return {
        path: ref,
        ...(shouldAddLines && { lines: suggestLineRange(ref) }),
        reason: isContextFile 
          ? 'Standards and patterns to follow'
          : 'Existing code to reference'
      };
    }
    return ref; // Already in enhanced format
  });
};

/**
 * Get file size in lines (returns 0 if file doesn't exist)
 */
const getFileSize = (filePath: string): number => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fileExists(fullPath)) {
    return 0;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
};

/**
 * Suggest line range for a file (placeholder - would need smarter logic)
 */
const suggestLineRange = (filePath: string): string | undefined => {
  const size = getFileSize(filePath);
  if (size === 0 || size <= 100) {
    return undefined;
  }
  
  // For now, suggest reading first half of large files
  // In production, this would use semantic analysis
  return `1-${Math.floor(size / 2)}`;
};

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

/**
 * Migrate task.json file
 */
const migrateTaskFile = (
  taskPath: string,
  options: MigrationOptions
): MigrationResult => {
  const changes: string[] = [];
  
  try {
    const task = readJSON<BaseTask>(taskPath);
    const enhanced: EnhancedTask = { ...task };
    
    // Convert context_files to enhanced format
    if (options.linesOnly || !isEnhancedFormat(task.context_files)) {
      const converted = convertToEnhancedFormat(task.context_files, true);
      if (converted) {
        enhanced.context_files = converted;
        changes.push('Added line-number precision to context_files');
      }
    }
    
    // Convert reference_files to enhanced format
    if (options.linesOnly || !isEnhancedFormat(task.reference_files)) {
      const converted = convertToEnhancedFormat(task.reference_files, false);
      if (converted) {
        enhanced.reference_files = converted;
        changes.push('Added line-number precision to reference_files');
      }
    }
    
    // Add domain modeling fields
    if (options.addDomain) {
      if (options.boundedContext && !enhanced.bounded_context) {
        enhanced.bounded_context = options.boundedContext;
        changes.push(`Added bounded_context: ${options.boundedContext}`);
      }
      
      if (options.module && !enhanced.module) {
        enhanced.module = options.module;
        changes.push(`Added module: ${options.module}`);
      }
      
      if (options.verticalSlice && !enhanced.vertical_slice) {
        enhanced.vertical_slice = options.verticalSlice;
        changes.push(`Added vertical_slice: ${options.verticalSlice}`);
      }
    }
    
    // Add release slice
    if (options.releaseSlice && !enhanced.release_slice) {
      enhanced.release_slice = options.releaseSlice;
      changes.push(`Added release_slice: ${options.releaseSlice}`);
    }
    
    // Write changes if not dry run
    if (!options.dryRun && changes.length > 0) {
      writeJSON(taskPath, enhanced);
    }
    
    return {
      file: taskPath,
      status: changes.length > 0 ? 'migrated' : 'skipped',
      changes
    };
  } catch (err) {
    return {
      file: taskPath,
      status: 'error',
      changes: [],
      error: err instanceof Error ? err.message : String(err)
    };
  }
};

/**
 * Migrate subtask_NN.json file
 */
const migrateSubtaskFile = (
  subtaskPath: string,
  options: MigrationOptions,
  taskDomain?: { boundedContext?: string; module?: string; verticalSlice?: string }
): MigrationResult => {
  const changes: string[] = [];
  
  try {
    const subtask = readJSON<BaseSubtask>(subtaskPath);
    const enhanced: EnhancedSubtask = { ...subtask };
    
    // Convert context_files to enhanced format
    if (options.linesOnly || !isEnhancedFormat(subtask.context_files)) {
      const converted = convertToEnhancedFormat(subtask.context_files, true);
      if (converted) {
        enhanced.context_files = converted;
        changes.push('Added line-number precision to context_files');
      }
    }
    
    // Convert reference_files to enhanced format
    if (options.linesOnly || !isEnhancedFormat(subtask.reference_files)) {
      const converted = convertToEnhancedFormat(subtask.reference_files, false);
      if (converted) {
        enhanced.reference_files = converted;
        changes.push('Added line-number precision to reference_files');
      }
    }
    
    // Inherit domain fields from task if not already set
    if (taskDomain) {
      if (taskDomain.boundedContext && !enhanced.bounded_context) {
        enhanced.bounded_context = taskDomain.boundedContext;
        changes.push(`Inherited bounded_context: ${taskDomain.boundedContext}`);
      }
      
      if (taskDomain.module && !enhanced.module) {
        enhanced.module = taskDomain.module;
        changes.push(`Inherited module: ${taskDomain.module}`);
      }
      
      if (taskDomain.verticalSlice && !enhanced.vertical_slice) {
        enhanced.vertical_slice = taskDomain.verticalSlice;
        changes.push(`Inherited vertical_slice: ${taskDomain.verticalSlice}`);
      }
    }
    
    // Write changes if not dry run
    if (!options.dryRun && changes.length > 0) {
      writeJSON(subtaskPath, enhanced);
    }
    
    return {
      file: subtaskPath,
      status: changes.length > 0 ? 'migrated' : 'skipped',
      changes
    };
  } catch (err) {
    return {
      file: subtaskPath,
      status: 'error',
      changes: [],
      error: err instanceof Error ? err.message : String(err)
    };
  }
};

/**
 * Migrate a single task (task.json + all subtasks)
 */
const migrateTask = (taskName: string, options: MigrationOptions): MigrationResult[] => {
  const results: MigrationResult[] = [];
  const taskDir = path.join(TASKS_DIR, taskName);
  
  if (!fileExists(taskDir)) {
    return [{
      file: taskName,
      status: 'error',
      changes: [],
      error: `Task directory not found: ${taskDir}`
    }];
  }
  
  // Migrate task.json
  const taskPath = path.join(taskDir, 'task.json');
  if (fileExists(taskPath)) {
    const taskResult = migrateTaskFile(taskPath, options);
    results.push(taskResult);
    
    // Get domain fields from migrated task for subtasks
    const task = readJSON<EnhancedTask>(taskPath);
    const taskDomain = {
      boundedContext: task.bounded_context,
      module: task.module,
      verticalSlice: task.vertical_slice
    };
    
    // Migrate all subtasks
    const subtaskFiles = getSubtaskFiles(taskDir);
    for (const subtaskPath of subtaskFiles) {
      const subtaskResult = migrateSubtaskFile(subtaskPath, options, taskDomain);
      results.push(subtaskResult);
    }
  } else {
    results.push({
      file: taskPath,
      status: 'error',
      changes: [],
      error: 'task.json not found'
    });
  }
  
  return results;
};

/**
 * Migrate all tasks
 */
const migrateAllTasks = (options: MigrationOptions): MigrationResult[] => {
  const results: MigrationResult[] = [];
  const taskDirs = getTaskDirectories();
  
  for (const taskName of taskDirs) {
    const taskResults = migrateTask(taskName, options);
    results.push(...taskResults);
  }
  
  return results;
};

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Print migration results
 */
const printResults = (results: MigrationResult[], options: MigrationOptions): void => {
  const prefix = options.dryRun ? '[DRY RUN] ' : '';
  
  console.log('\n' + prefix + 'Migration Results:');
  console.log('='.repeat(60));
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const result of results) {
    const fileName = path.basename(result.file);
    
    if (result.status === 'migrated') {
      migrated++;
      console.log(`\n✓ ${fileName}`);
      for (const change of result.changes) {
        console.log(`  - ${change}`);
      }
    } else if (result.status === 'skipped') {
      skipped++;
      console.log(`\n- ${fileName} (no changes needed)`);
    } else {
      errors++;
      console.log(`\n✗ ${fileName}`);
      console.log(`  Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} files`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  
  if (options.dryRun) {
    console.log('\nThis was a dry run. No files were modified.');
    console.log('Remove --dry-run to apply changes.');
  }
};

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

/**
 * Parse command line arguments
 */
const parseArgs = (): MigrationOptions => {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--task':
        options.task = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--lines-only':
        options.linesOnly = true;
        break;
      case '--add-domain':
        options.addDomain = true;
        break;
      case '--bounded-context':
        options.boundedContext = args[++i];
        break;
      case '--module':
        options.module = args[++i];
        break;
      case '--vertical-slice':
        options.verticalSlice = args[++i];
        break;
      case '--release':
        options.releaseSlice = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  
  return options;
};

/**
 * Print help message
 */
const printHelp = (): void => {
  console.log(`
Task Schema Migration Script

Usage:
  npx ts-node migrate-schema.ts [options]

Options:
  --task <name>              Migrate specific task
  --all                      Migrate all tasks
  --dry-run                  Preview changes without writing
  --lines-only               Add line-number precision only
  --add-domain               Add domain modeling fields
  --bounded-context <name>   Set bounded_context
  --module <name>            Set module
  --vertical-slice <name>    Set vertical_slice
  --release <name>           Set release_slice
  --help, -h                 Show this help message

Examples:
  # Migrate single task
  npx ts-node migrate-schema.ts --task auth-system

  # Dry run to preview changes
  npx ts-node migrate-schema.ts --task auth-system --dry-run

  # Add line-number precision only
  npx ts-node migrate-schema.ts --task auth-system --lines-only

  # Add domain modeling
  npx ts-node migrate-schema.ts --task auth-system --add-domain \\
    --bounded-context authentication --module @app/auth

  # Migrate all tasks
  npx ts-node migrate-schema.ts --all
`);
};

// ============================================================================
// MAIN
// ============================================================================

const main = (): void => {
  const options = parseArgs();
  
  // Validate options
  if (!options.task && !options.all) {
    console.error('Error: Must specify --task <name> or --all');
    printHelp();
    process.exit(1);
  }
  
  if (options.task && options.all) {
    console.error('Error: Cannot use both --task and --all');
    printHelp();
    process.exit(1);
  }
  
  // Run migration
  const results = options.all 
    ? migrateAllTasks(options)
    : migrateTask(options.task!, options);
  
  // Print results
  printResults(results, options);
  
  // Exit with error code if any errors occurred
  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
};

// Run if executed directly
if (require.main === module) {
  main();
}

export { migrateTask, migrateAllTasks, type MigrationOptions, type MigrationResult };
