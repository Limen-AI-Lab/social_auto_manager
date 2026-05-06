import type { WebhookRequestItem } from '../types';

export interface SendWebhookOptions {
  payloadField?: string;
  videoField?: string;
}

/**
 * Sends distribution payload and video file to n8n (or other) webhook via multipart/form-data.
 * Payload is JSON (requests array); video is sent as binary.
 */
export async function sendToDistributionWebhook(
  webhookUrl: string,
  payload: { requests: WebhookRequestItem[] },
  videoFile: File,
  options?: SendWebhookOptions
): Promise<void> {
  const payloadField = options?.payloadField ?? 'payload';
  const videoField = options?.videoField ?? 'video';

  // Debug: before send
  console.log('[Webhook] Sending', {
    url: webhookUrl,
    payloadField,
    videoField,
    payload: JSON.stringify(payload, null, 2),
    videoName: videoFile.name,
    videoSize: videoFile.size,
  });

  const formData = new FormData();
  formData.append(payloadField, JSON.stringify(payload));
  formData.append(videoField, videoFile, videoFile.name);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: formData,
  });

  const responseText = await response.text();

  // Debug: after send (success or failure)
  if (response.ok) {
    console.log('[Webhook] Success', { status: response.status, statusText: response.statusText, body: responseText });
  } else {
    console.log('[Webhook] Failed', { status: response.status, statusText: response.statusText, body: responseText });
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Sends distribution payload as JSON only (no binary). Use when mediaUrls point to Supabase or other public URLs.
 */
export async function sendDistributionPayloadJson(
  webhookUrl: string,
  payload: { requests: WebhookRequestItem[] }
): Promise<void> {
  console.log('[Webhook] Sending JSON only', {
    url: webhookUrl,
    payload: JSON.stringify(payload, null, 2),
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (response.ok) {
    console.log('[Webhook] Success', { status: response.status, statusText: response.statusText, body: responseText });
  } else {
    console.log('[Webhook] Failed', { status: response.status, statusText: response.statusText, body: responseText });
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}
