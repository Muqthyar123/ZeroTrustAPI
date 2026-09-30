import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateScanSchema } from '../validators/scan.validator.js';
import { ScanService, scanService } from '../services/scan.service.js';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ScansController {
  constructor(private scans: ScanService = scanService) {}

  public postScan = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateScanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid scan payload structure',
        details: parseResult.error.format()
      });
    }

    try {
      const saved = await this.scans.recordScan(request.body as Record<string, any>);
      return reply.status(201).send(saved);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to record scan'
      });
    }
  };

  public getScans = async (_request: FastifyRequest, reply: FastifyReply) => {
    const allScans = await this.scans.getAllScans();
    return reply.status(200).send(allScans);
  };

  public getScanById = async (
    request: FastifyRequest<{ Params: { scanId: string } }>,
    reply: FastifyReply
  ) => {
    const { scanId } = request.params;
    const scan = await this.scans.getScanById(scanId);
    if (!scan) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Scan report with ID '${scanId}' not found`
      });
    }
    return reply.status(200).send(scan);
  };

  public runScan = async (
    request: FastifyRequest<{
      Body: {
        targetUrl?: string;
        openapiUrl?: string;
        fixturesUrl?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const targetUrl = request.body?.targetUrl || 'http://localhost:8080';
    const openapiUrl = request.body?.openapiUrl || `${targetUrl}/openapi.json`;
    const fixturesUrl = request.body?.fixturesUrl || `${targetUrl}/_test/fixtures`;
    const reportUrl = 'http://localhost:5000';

    try {
      const projectRoot = path.resolve(__dirname, '..', '..', '..');
      const cliPath = path.resolve(projectRoot, 'scanner', 'dist', 'cli.js');

      const args = [
        'scan',
        '--openapi', openapiUrl,
        '--fixtures', fixturesUrl,
        '--target', targetUrl,
        '--report', reportUrl,
      ];

      const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
        execFile('node', [cliPath, ...args], { cwd: projectRoot }, (error, stdout, stderr) => {
          const exitCode = error && typeof error.code === 'number' ? error.code : 0;
          resolve({ exitCode, stdout, stderr });
        });
      });

      const allScans = await this.scans.getAllScans();
      const latestScan = allScans[0] || null;

      return reply.status(200).send({
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout,
        scan: latestScan,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Scan Execution Failed',
        message: err.message || 'Failed to run scanner CLI',
      });
    }
  };
}

export const scansController = new ScansController();
