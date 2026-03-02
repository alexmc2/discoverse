import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const defaults = {
  binding: 'MUSIC_CACHE',
  topKey: 'archive:top-tracks:v1',
  artistKey: 'archive:artist-cache:v1',
  env: undefined,
  skipPreview: false,
  dryRun: false,
};

function parseArgs(argv) {
  const args = { ...defaults };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--binding') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --binding');
      args.binding = value;
      i++;
      continue;
    }
    if (token.startsWith('--binding=')) {
      args.binding = token.slice('--binding='.length);
      continue;
    }

    if (token === '--top-key') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --top-key');
      args.topKey = value;
      i++;
      continue;
    }
    if (token.startsWith('--top-key=')) {
      args.topKey = token.slice('--top-key='.length);
      continue;
    }

    if (token === '--artist-key') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --artist-key');
      args.artistKey = value;
      i++;
      continue;
    }
    if (token.startsWith('--artist-key=')) {
      args.artistKey = token.slice('--artist-key='.length);
      continue;
    }

    if (token === '--env') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --env');
      args.env = value;
      i++;
      continue;
    }
    if (token.startsWith('--env=')) {
      args.env = token.slice('--env='.length);
      continue;
    }

    if (token === '--skip-preview') {
      args.skipPreview = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(
    [
      'Upload large JSON archives into a KV namespace for runtime lookup.',
      '',
      'Usage:',
      '  npm run kv:upload-archives',
      '  npm run kv:upload-archives -- --env production',
      '  npm run kv:upload-archives -- --binding MUSIC_CACHE --skip-preview',
      '',
      'Options:',
      '  --binding <name>      KV binding in wrangler config (default: MUSIC_CACHE)',
      '  --top-key <key>       Key for top-tracks archive',
      '  --artist-key <key>    Key for artist cache archive',
      '  --env <name>          Wrangler env (optional, e.g. production)',
      '  --skip-preview        Skip uploading to preview namespace',
      '  --dry-run             Print commands only',
    ].join('\n')
  );
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function uploadOne({ key, filePath, preview, binding, env, dryRun }) {
  const args = [
    'wrangler',
    'kv',
    'key',
    'put',
    key,
    '--binding',
    binding,
    '--path',
    filePath,
    '--remote',
  ];
  args.push('--preview', preview ? 'true' : 'false');
  if (env) args.push('--env', env);

  const label = preview ? 'preview' : 'production';
  const display = `npx ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
  console.log(`[${label}] ${display}`);

  if (!dryRun) {
    await run('npx', args, ROOT_DIR);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const topPath = path.resolve(ROOT_DIR, 'data/top-tracks-archive.json');
  const artistPath = path.resolve(ROOT_DIR, 'data/artist-cache.json');

  const uploads = [
    { key: args.topKey, filePath: topPath, preview: false },
    { key: args.artistKey, filePath: artistPath, preview: false },
  ];

  if (!args.skipPreview) {
    uploads.push(
      { key: args.topKey, filePath: topPath, preview: true },
      { key: args.artistKey, filePath: artistPath, preview: true }
    );
  }

  for (const upload of uploads) {
    await uploadOne({
      ...upload,
      binding: args.binding,
      env: args.env,
      dryRun: args.dryRun,
    });
  }

  console.log('KV archive upload complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
