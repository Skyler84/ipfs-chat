import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import fetch from 'node-fetch';
import FormData from 'form-data';
import qrcode from 'qrcode-terminal';

const KUBO_URL = process.env.KUBO_URL || 'http://127.0.0.1:5001';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080/';
// Assume the repo root is the current working directory if not specified
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();
const CAR_FILE = path.join(REPO_ROOT, 'dist.car');

type IpnsKey = {
  Name: string;
  Id: string;
};

type PublishOptions = {
  ipnsKeyRef?: string;
};

function parseArgValue(args: string[], keys: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    for (const key of keys) {
      if (arg === key && args[i + 1]) {
        return args[i + 1];
      }

      if (arg.startsWith(`${key}=`)) {
        return arg.slice(key.length + 1);
      }
    }
  }

  return undefined;
}

function resolvePublishOptions(argv: string[]): PublishOptions {
  const ipnsKeyRef =
    parseArgValue(argv, ['--ipns-key', '--key', '--identity', '-k']) ||
    process.env.IPNS_KEY ||
    process.env.IPNS_KEY_NAME ||
    process.env.IPNS_IDENTITY;

  return { ipnsKeyRef };
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function buildApiUrl(endpoint: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `${KUBO_URL}${endpoint}?${query.toString()}`;
}

function buildGatewayUrl(namespace: 'ipfs' | 'ipns', value: string): string {
  return `${normalizeBaseUrl(GATEWAY_URL)}${namespace}/${value}`;
}

async function promptYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('IPNS key is missing and prompt is required, but no interactive TTY is available.');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(question, resolve);
    });

    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function getBranchAndCommit(): Promise<{ description: string; tag: string; commit: string; dirty: boolean, branch: string }> {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const describe = execSync('git describe --always --dirty', { encoding: 'utf-8' }).trim();
    const isDirty = describe.endsWith('-dirty');
    const cleanDescribe = isDirty ? describe.slice(0, -6) : describe;
    const parts = cleanDescribe.split('-');
    
    let tag = '';
    let commit = '';
    
    if (parts.length >= 3) {
      tag = parts.slice(0, -2).join('-');
      commit = parts[parts.length - 1];
    } else {
      commit = cleanDescribe;
    }
    
    return { description: describe, tag, commit, dirty: isDirty, branch: branch };
} catch (error) {
    throw new Error('Failed to get git describe information');
  }
}

async function uploadToIPFS(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CAR file not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const form = new FormData();
  form.append('file', fileStream);

  const response = await fetch(`${KUBO_URL}/api/v0/dag/import`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to IPFS: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split('\n').filter((line: string) => line.trim());
  
  if (lines.length === 0) {
    throw new Error('No response from IPFS dag/import');
  }

  const lastLine = JSON.parse(lines[lines.length - 1]);
  const cid = lastLine.Root?.Cid?.['/'] || lastLine.Cid?.['/'];
  
  if (!cid) {
    throw new Error('Failed to extract CID from IPFS response');
  }

  return cid;
}

async function listIpnsKeys(): Promise<IpnsKey[]> {
  const response = await fetch(buildApiUrl('/api/v0/key/list', {}), {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to list IPNS keys: ${response.statusText}`);
  }

  const payload = await response.json() as { Keys?: IpnsKey[] };
  return payload.Keys || [];
}

async function createIpnsKey(name: string): Promise<IpnsKey> {
  const response = await fetch(
    buildApiUrl('/api/v0/key/gen', {
      arg: name,
      type: 'ed25519',
    }),
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(`Failed to create IPNS key: ${response.statusText}`);
  }

  const payload = await response.json() as { Name?: string; Id?: string };
  if (!payload.Name || !payload.Id) {
    throw new Error('IPNS key creation returned an unexpected response.');
  }

  return { Name: payload.Name, Id: payload.Id };
}

async function resolveIpnsKey(keyRef: string): Promise<IpnsKey> {
  const keys = await listIpnsKeys();
  const existing = keys.find((k) => k.Name === keyRef || k.Id === keyRef);

  if (existing) {
    return existing;
  }

  const shouldCreate = await promptYesNo(
    `IPNS key "${keyRef}" was not found. Generate a new key with this name? [y/N]: `
  );

  if (!shouldCreate) {
    throw new Error(`Aborted: missing IPNS key "${keyRef}".`);
  }

  return createIpnsKey(keyRef);
}

async function publishIpnsRecord(cid: string, keyName: string): Promise<{ name: string; value: string }> {
  const response = await fetch(
    buildApiUrl('/api/v0/name/publish', {
      arg: `/ipfs/${cid}`,
      key: keyName,
      'allow-offline': 'true',
    }),
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(`Failed to publish IPNS record: ${response.statusText}`);
  }

  const payload = await response.json() as { Name?: string; Value?: string };
  if (!payload.Name || !payload.Value) {
    throw new Error('IPNS publish returned an unexpected response.');
  }

  return { name: payload.Name, value: payload.Value };
}

function extractResolvedPath(raw: string): string | undefined {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }

  const lastLine = lines[lines.length - 1];

  try {
    const payload = JSON.parse(lastLine) as { Path?: string };
    return payload.Path;
  } catch {
    return lastLine;
  }
}

function ipnsResolvesToCid(resolvedPath: string, cid: string): boolean {
  const normalized = resolvedPath.trim().replace(/\/+$/, '');
  const expected = `/ipfs/${cid}`;
  return normalized === expected || normalized.startsWith(`${expected}/`);
}

async function resolveIpnsPath(name: string): Promise<string | undefined> {
  const response = await fetch(
    buildApiUrl('/api/v0/name/resolve', {
      arg: `/ipns/${name}`,
      recursive: 'true',
      nocache: 'true',
    }),
    { method: 'POST' }
  );

  const responseText = await response.text();

  if (!response.ok) {
    // Missing or unpublished names should not fail the publish flow.
    if (/(could not resolve|not found|no record|routing: not found|failed to find)/i.test(responseText)) {
      return undefined;
    }

    throw new Error(`Failed to resolve IPNS name: ${response.statusText} - ${responseText}`);
  }

  return extractResolvedPath(responseText);
}

async function addToMFS(cid: string, mfsPath: string): Promise<void> {
  // Create parent directories first
  const parentPath = mfsPath.substring(0, mfsPath.lastIndexOf('/'));
  const mkdirResponse = await fetch(
    `${KUBO_URL}/api/v0/files/mkdir?arg=${encodeURIComponent(parentPath)}&parents=true`,
    { method: 'POST' }
  );

  if (!mkdirResponse.ok) {
    throw new Error(`Failed to create MFS directories: ${mkdirResponse.statusText}`);
  }

  const response = await fetch(
    `${KUBO_URL}/api/v0/files/cp?arg=${encodeURIComponent(`/ipfs/${cid}`)}&arg=${encodeURIComponent(mfsPath)}`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(`Failed to add to MFS: ${response.statusText}`);
  }
}

async function generateQRCodeLines(text: string): Promise<string[]> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (qr: string) => {
      resolve(qr.split('\n'));
    });
  });
}

async function generateQRCodesSideBySide(
  leftLabel: string,
  leftText: string,
  rightLabel: string,
  rightText: string
): Promise<void> {
  const [leftLines, rightLines] = await Promise.all([
    generateQRCodeLines(leftText),
    generateQRCodeLines(rightText),
  ]);

  const gap = '    ';
  const leftWidth = Math.max(leftLabel.length, ...leftLines.map((line) => line.length));
  const rightWidth = Math.max(rightLabel.length, ...rightLines.map((line) => line.length));
  const maxHeight = Math.max(leftLines.length, rightLines.length);

  console.log(`${leftLabel.padEnd(leftWidth)}${gap}${rightLabel.padEnd(rightWidth)}`);

  for (let i = 0; i < maxHeight; i += 1) {
    const left = leftLines[i] || '';
    const right = rightLines[i] || '';
    console.log(`${left.padEnd(leftWidth)}${gap}${right.padEnd(rightWidth)}`);
  }
}

async function main() {
  try {
    console.log('Publishing to IPFS...\n');
    const options = resolvePublishOptions(process.argv.slice(2));

    const { branch, description, dirty } = await getBranchAndCommit();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const mfsPath = `/self/ipfs-chat/${branch}/${description}${dirty ? `_${timestamp}` : ''}`;

    console.log(`Branch: ${branch}`);
    console.log(`Description: ${description}`);
    console.log(`Timestamp: ${timestamp}\n`);

    console.log('Uploading CAR file to IPFS...');
    const cid = await uploadToIPFS(CAR_FILE);
    console.log(`✓ CID: ${cid}\n`);

    console.log(`Adding to MFS at ${mfsPath}...`);
    await addToMFS(cid, mfsPath);
    console.log('✓ Added to MFS\n');

    const gatewayUrl = buildGatewayUrl('ipfs', cid);
    let ipnsGatewayUrl: string | undefined;

    if (options.ipnsKeyRef) {
      console.log(`Resolving IPNS key: ${options.ipnsKeyRef}...`);
      const ipnsKey = await resolveIpnsKey(options.ipnsKeyRef);
      console.log(`✓ Using IPNS key: ${ipnsKey.Name} (${ipnsKey.Id})`);

      console.log('Checking current IPNS target...');
      const currentResolvedPath = await resolveIpnsPath(ipnsKey.Id);

      if (currentResolvedPath && ipnsResolvesToCid(currentResolvedPath, cid)) {
        console.log(`✓ IPNS already points to ${cid}; skipping publish.\n`);
      } else {
        console.log('Publishing IPNS record...');
        const ipnsRecord = await publishIpnsRecord(cid, ipnsKey.Name);
        console.log(`✓ IPNS Name: ${ipnsRecord.name}`);
        console.log(`✓ IPNS Value: ${ipnsRecord.value}\n`);
      }

      ipnsGatewayUrl = buildGatewayUrl('ipns', ipnsKey.Id);
    } else {
      console.log('No IPNS key provided; skipping IPNS publish.\n');
    }
    
    console.log('Generating QR code(s)...\n');

    if (ipnsGatewayUrl) {
      await generateQRCodesSideBySide('IPFS', gatewayUrl, 'IPNS', ipnsGatewayUrl);
      console.log('');
      console.log(`IPFS Gateway URL: ${gatewayUrl}`);
      console.log(`IPNS Gateway URL: ${ipnsGatewayUrl}\n`);
    } else {
      const ipfsLines = await generateQRCodeLines(gatewayUrl);
      ipfsLines.forEach((line) => console.log(line));
      console.log(`IPFS Gateway URL: ${gatewayUrl}\n`);
    }
} catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
