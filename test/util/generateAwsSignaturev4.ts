/* 
    Feature: Generate AWS Signature V4 for a request using no SDK
    Scenario: Generate AWS Signature V4 for a lambda list functions request
    Given a request to list lambda functions
    When I generate the AWS Signature V4 for the request
    Then the request has the correct headers
*/

import * as crypto from 'crypto';

interface AwsSignatureConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export function generateAwsSignatureV4(
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body: string,
  config: AwsSignatureConfig
): Record<string, string> {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);

  // Task 1: Create a canonical request
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}\n`)
    .join('');

  const signedHeaders = Object.keys(headers)
    .sort()
    .map((h) => h.toLowerCase())
    .join(';');

  const canonicalQueryString = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update(body).digest('hex')
  ].join('\n');

  // Task 2: Create string to sign
  const credentialScope = `${date}/${config.region}/${config.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Task 3: Calculate signature
  const kDate = hmac(`AWS4${config.secretAccessKey}`, date);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, config.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  // Task 4: Add signature to headers
  return {
    Authorization: [
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', '),
    'X-Amz-Date': timestamp
  };
}

function hmac(key: string | Buffer, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}
