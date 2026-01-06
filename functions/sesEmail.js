/* eslint-disable */
'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const logger = require('firebase-functions/logger');

let sesClient;

/**
 * Get or create the SES client singleton
 * Credentials are pulled from environment variables set by Firebase secrets
 */
function getSESClient(region) {
  if (!sesClient) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets.',
      );
    }

    sesClient = new SESClient({
      region: region || process.env.AWS_SES_REGION || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return sesClient;
}

/**
 * Send an email via Amazon SES
 * @param {Object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} params.from - Sender (e.g., 'RAGESTATE <orders@ragestate.com>')
 * @param {string} [params.replyTo] - Reply-to address
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain text body
 * @param {string} [params.html] - HTML body
 * @param {string} [params.region] - AWS region (default: us-east-1)
 * @returns {Promise<{messageId: string}>}
 */
async function sendEmail({ to, from, replyTo, subject, text, html, region }) {
  const client = getSESClient(region);

  const toAddresses = Array.isArray(to) ? to : [to];

  const command = new SendEmailCommand({
    Source: from,
    Destination: {
      ToAddresses: toAddresses,
    },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
        ...(html && { Html: { Data: html, Charset: 'UTF-8' } }),
      },
    },
  });

  const response = await client.send(command);

  logger.info('SES email sent', {
    messageId: response.MessageId,
    to: toAddresses.join(', '),
    subject,
  });

  return { messageId: response.MessageId };
}

/**
 * Send bulk emails individually (one per recipient for privacy)
 * For marketing campaigns or batch notifications
 * @param {Object} params
 * @param {string[]} params.recipients - Array of recipient emails
 * @param {string} params.from - Sender address
 * @param {string} [params.replyTo] - Reply-to address
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain text body
 * @param {string} [params.html] - HTML body
 * @param {string} [params.region] - AWS region
 * @returns {Promise<{messageId: string, email: string}[]>}
 */
async function sendBulkEmail({ recipients, from, replyTo, subject, text, html, region }) {
  // Send emails individually to protect recipient privacy
  // Process in batches of 10 concurrent sends to avoid rate limits
  const CONCURRENCY = 10;
  const results = [];
  const errors = [];

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (email) => {
        const result = await sendEmail({
          to: email,
          from,
          replyTo,
          subject,
          text,
          html,
          region,
        });
        return { ...result, email };
      }),
    );

    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        errors.push({ email: batch[idx], error: r.reason?.message || 'Unknown error' });
        logger.warn('SES bulk email: individual send failed', {
          email: batch[idx],
          error: r.reason?.message,
        });
      }
    });
  }

  logger.info('SES bulk email completed', {
    totalRecipients: recipients.length,
    successful: results.length,
    failed: errors.length,
  });

  return results;
}

/**
 * Reset the SES client (useful for testing)
 */
function resetClient() {
  sesClient = null;
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  getSESClient,
  resetClient,
};
