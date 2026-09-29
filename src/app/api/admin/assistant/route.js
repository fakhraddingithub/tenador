import requireAdminPermission from '@/lib/requireAdminPermission';
import { generateJson, getAssistantConfig } from '@/lib/assistant/gemini';
import { readChatBody, AssistantError } from '@/lib/assistant/validation';
import { runAssistant } from '@/lib/assistant/orchestrator';
import { consumeAssistantQuota } from '@/lib/assistant/quota';
import { executeAssistantTool } from 'base/services/adminAssistantTools';
import { availableCatalog, TOOL_PERMISSIONS } from '@/lib/assistant/catalog';
import { recordAdminActivity } from '@/lib/adminActivity';

export const runtime = 'nodejs';
export const maxDuration = 120;
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const { ctx, denied } = await requireAdminPermission('assistant.use', { audit: false });
  if (denied) return denied;
  const config = getAssistantConfig();
  return Response.json({ ready: config.configured && config.enabled,
    datasets: availableCatalog(ctx.permissions).map(({ title }) => title),
    tools: Object.entries(TOOL_PERMISSIONS).filter(([, permission]) => ctx.permissions.includes(permission)).map(([name]) => name),
  }, { headers });
}

export async function POST(request) {
  const { ctx, denied } = await requireAdminPermission('assistant.use', { audit: false });
  if (denied) return denied;
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new AssistantError('مبدأ درخواست مجاز نیست.', 403);
    const input = await readChatBody(request);
    const config = getAssistantConfig();
    if (!config.enabled || !config.configured) throw new AssistantError('دستیار هنوز روی سرور فعال نشده است.', 503);
    await consumeAssistantQuota(ctx.userId);
    const result = await runAssistant({ ...input, permissions: ctx.permissions, actorId: ctx.membership?._id?.toString() || ctx.userId,
      generate: generateJson, execute: async (query, permissions, now) => {
        if (query.tool === 'activity' && ctx.permissions.includes('admins.viewActivity')) {
          await recordAdminActivity({ ctx, action: 'authz.read', permissions: ['admins.viewActivity'], result: 'attempted', statusCode: 200 });
        }
        return executeAssistantTool(query, permissions, now);
      },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(105000)]),
    });
    // No prompts, database results, keys, or personal data in operational logs.
    console.info('[assistant]', { calls: result.calls, tokens: result.tokens });
    return Response.json(result, { headers });
  } catch (error) {
    const known = error instanceof AssistantError;
    if (!known) console.error('[assistant] request failed', { type: error?.name, code: typeof error?.code === 'number' ? error.code : undefined });
    return Response.json({ message: known ? error.message : 'دریافت پاسخ ممکن نشد؛ لطفاً دوباره تلاش کنید.' }, { status: known ? error.status : 500, headers });
  }
}
