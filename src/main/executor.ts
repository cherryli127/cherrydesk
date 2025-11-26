import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileOperation } from './utils/diff';

interface ExecutionResult {
    success: boolean;
    processed: number;
    errors: string[];
}

interface LogEntry {
    timestamp: number;
    operations: { source: string; destination: string }[];
}

export class BatchExecutor {
    private logDir: string;

    constructor() {
        // Store logs in the OS temp directory or app user data in production
        this.logDir = path.join(os.tmpdir(), 'cherrydesk-logs');
    }

    private async ensureLogDir() {
        try {
            await fs.access(this.logDir);
        } catch {
            await fs.mkdir(this.logDir, { recursive: true });
        }
    }

    private async getUniquePath(targetPath: string): Promise<string> {
        try {
            await fs.access(targetPath);
            // File exists, append suffix
            const ext = path.extname(targetPath);
            const name = path.basename(targetPath, ext);
            const dir = path.dirname(targetPath);
            
            let counter = 1;
            while (true) {
                const newPath = path.join(dir, `${name} (${counter})${ext}`);
                try {
                    await fs.access(newPath);
                    counter++;
                } catch {
                    return newPath;
                }
            }
        } catch {
            // File doesn't exist, safe to use
            return targetPath;
        }
    }

    async execute(operations: FileOperation[]): Promise<ExecutionResult> {
        await this.ensureLogDir();
        
        const executedOps: { source: string; destination: string }[] = [];
        const errors: string[] = [];
        
        // Create transaction log ID
        const logId = Date.now();

        for (const op of operations) {
            if (op.type === 'move') {
                try {
                    const destDir = path.dirname(op.destination);
                    await fs.mkdir(destDir, { recursive: true });
                    
                    const uniqueDest = await this.getUniquePath(op.destination);
                    
                    await fs.rename(op.source, uniqueDest);
                    
                    executedOps.push({ 
                        source: op.source, 
                        destination: uniqueDest // Record actual destination used
                    });
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    errors.push(`Failed to move ${op.source}: ${msg}`);
                }
            }
        }

        // Save log
        if (executedOps.length > 0) {
            const logEntry: LogEntry = {
                timestamp: logId,
                operations: executedOps
            };
            await fs.writeFile(
                path.join(this.logDir, `batch-${logId}.json`), 
                JSON.stringify(logEntry, null, 2)
            );
        }

        return {
            success: errors.length === 0,
            processed: executedOps.length,
            errors
        };
    }

    async undoLastBatch(): Promise<ExecutionResult> {
        await this.ensureLogDir();
        
        const files = await fs.readdir(this.logDir);
        const logs = files
            .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
            .sort()
            .reverse();

        if (logs.length === 0) {
            return { success: false, processed: 0, errors: ['No undo history found'] };
        }

        const lastLogPath = path.join(this.logDir, logs[0]);
        const logContent = await fs.readFile(lastLogPath, 'utf-8');
        const log: LogEntry = JSON.parse(logContent);

        const executedOps: { source: string; destination: string }[] = [];
        const errors: string[] = [];

        // Reverse operations
        // We need to move FROM destination TO source
        for (const op of log.operations.reverse()) {
            try {
                // Ensure original source directory exists (it might be empty/deleted now?)
                // fs.rename handles directory creation? No, we must ensure dir.
                await fs.mkdir(path.dirname(op.source), { recursive: true });
                
                await fs.rename(op.destination, op.source);
                executedOps.push({ source: op.destination, destination: op.source });
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                errors.push(`Failed to revert ${op.destination}: ${msg}`);
            }
        }

        // Delete log file if successful (or mostly successful)
        if (errors.length === 0) {
            await fs.unlink(lastLogPath);
        }

        return {
            success: errors.length === 0,
            processed: executedOps.length,
            errors
        };
    }
}

