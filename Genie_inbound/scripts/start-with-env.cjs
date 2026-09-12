const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envFile = process.argv[2];

if (!envFile) {
  console.error('Usage: node scripts/start-with-env.cjs <env-file>');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Environment file not found: ${envPath}`);
  process.exit(1);
}

const env = { ...process.env, ...parseEnvFile(fs.readFileSync(envPath, 'utf8')) };
const cracoBin = path.resolve(
  process.cwd(),
  'node_modules',
  '@craco',
  'craco',
  'dist',
  'bin',
  'craco.js'
);

const child = spawn(process.execPath, [cracoBin, 'start'], {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function parseEnvFile(content) {
  return content
    .split(/\r?\n/)
    .reduce((values, rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        return values;
      }

      const equalsIndex = line.indexOf('=');

      if (equalsIndex === -1) {
        return values;
      }

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();

      if (!key) {
        return values;
      }

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[key] = value;
      return values;
    }, {});
}
