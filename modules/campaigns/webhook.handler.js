import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.success('Webhook verified');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  try {
    const signature = request.headers.get('x-hub-signature-256');
    const rawBody = await request.text();

    const APP_SECRET = process.env.META_APP_SECRET;

    if (!verifyMetaWebhook(signature, rawBody, APP_SECRET)) {
      logger.error('Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    logger.info('Webhook received', { object: body.object });

    if (body.object === 'page') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          await processWebhookChange(change);
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    logger.error('Webhook processing failed', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function processWebhookChange(change) {
  const { field, value } = change;

  logger.info('Processing webhook change', { field });

  switch (field) {
    case 'leadgen':
      await handleLeadGenEvent(value);
      break;
    case 'ads_insights':
      await handleAdsInsightsEvent(value);
      break;
    default:
      logger.info(`Unhandled webhook field: ${field}`);
  }
}

async function handleLeadGenEvent(value) {
  try {
    await prisma.lead.create({
      data: {
        leadgenId: value.leadgen_id,
        pageId: value.page_id,
        formId: value.form_id,
        adId: value.ad_id,
        createdTime: new Date(value.created_time * 1000),
      },
    });

    logger.success('Lead stored successfully');
  } catch (error) {
    logger.error('Failed to store lead', error);
  }
}

async function handleAdsInsightsEvent(value) {
  logger.info('Ads insights event', value);
}
