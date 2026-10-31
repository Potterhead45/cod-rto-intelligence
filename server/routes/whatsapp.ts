import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';
import { WhatsAppSimulator, WhatsAppWorkflowType } from '../engine/whatsapp.js';

const StartWorkflowSchema = z.object({
  workflow_type: z.enum(['SHIP_AFTER_CONFIRMATION', 'NUDGE_TO_PREPAID']),
  language: z.enum(['english', 'hinglish']).default('hinglish'),
  discount_amount: z.number().min(0).default(50)
});

const ReplySchema = z.object({
  text: z.string().min(1, 'Reply text is required')
});

const PaymentSchema = z.object({
  outcome: z.enum(['SUCCESS', 'FAILED'])
});

export async function whatsappRoutes(fastify: FastifyInstance) {
  const db = getDatabase();
  const simulator = new WhatsAppSimulator(db);

  // Get active WhatsApp conversation
  fastify.get('/api/orders/:id/whatsapp', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const conv = simulator.getConversation(id);
      return conv;
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // Start or initiate a WhatsApp workflow
  fastify.post('/api/orders/:id/whatsapp/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = StartWorkflowSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid workflow config', details: parsed.error.flatten() });
    }

    const { workflow_type, language, discount_amount } = parsed.data;

    try {
      const conv = simulator.startWorkflow(id, workflow_type, language, discount_amount);
      return reply.code(201).send(conv);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Simulate incoming customer reply
  fastify.post('/api/orders/:id/whatsapp/reply', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ReplySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Message text is required' });
    }

    try {
      const updated = simulator.processCustomerReply(id, parsed.data.text);
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Simulate payment gateway outcome (SUCCESS or FAILED)
  fastify.post('/api/orders/:id/whatsapp/payment', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = PaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payment outcome. Must be SUCCESS or FAILED.' });
    }

    try {
      const updated = simulator.simulatePayment(id, parsed.data.outcome);
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Simulate 24-hour timeout expiration
  fastify.post('/api/orders/:id/whatsapp/timeout', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const updated = simulator.simulateTimeout(id);
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
