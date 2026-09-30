import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateScanSchema } from '../validators/scan.validator.js';
import { ScanService, scanService } from '../services/scan.service.js';

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
}

export const scansController = new ScansController();
