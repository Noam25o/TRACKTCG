import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createScannerServer } from './server.mjs';
import { createVisualBridge } from './visual/bridge.mjs';

// Explicit command only. No tunnel at import, page load or `npm start`.
if (!process.argv.includes('--allow-public-test')) {
  console.error('Accord requis : cette commande expose temporairement le prototype via Cloudflare. Utilise npm run share volontairement.');
  process.exit(1);
}
const binary = fileURLToPath(new URL('.tools/cloudflared.exe', import.meta.url));
const expectedHash = 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2';
if (!existsSync(binary)) {
  console.error('Binaire officiel absent : voir README. Aucun téléchargement ni installation automatique.'); process.exit(1);
}
const actualHash = createHash('sha256').update(readFileSync(binary)).digest('hex');
if (actualHash !== expectedHash) {
  console.error('Empreinte cloudflared inattendue. Arrêt : vérifier la provenance/version avant de modifier cette empreinte.'); process.exit(1);
}
const visual = process.argv.includes('--visual-pc') ? createVisualBridge() : null;
const { server, token } = createScannerServer({ allowTunnel: true, visual });
const port = Number(process.env.SCAN_PORT || '8787');
let child = null, stopping = false, tunnel = null, printed = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  if (child && !child.killed) child.kill();
  server.closeAllConnections(); server.close();
  console.log('Prototype arrêté : clé invalidée, tunnel fermé.'); process.exitCode = code;
}
server.on('error', (error) => {
  console.error(`Impossible de démarrer : ${error.message}. Arrête uniquement l'ancien serveur scanner s'il utilise ce port.`); stop(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log('Démarrage du prototype et du tunnel temporaire Cloudflare…');
  console.log(visual ? 'Mode PC autorisé : capture JPEG envoyée au PC via Cloudflare, analysée en mémoire. Aucun service IA tiers.' : 'Le flux caméra reste sur le téléphone.');
  console.log('Garde le lien complet privé. Ctrl+C ferme le serveur et le tunnel.');
  child = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let pending = '';
  const output = (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/); pending = lines.pop();
    for (const line of lines) {
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) tunnel = match[0];
      if (tunnel && /Registered tunnel connection/.test(line) && !printed) {
        printed = true;
        console.log(`LIEN IPHONE : ${tunnel}/?access=${token}`);
        console.log('Ouvre dans Safari, choisis FR/EN/JP, puis scanne. Recherche manuelle en secours. Aucun compte Apple requis.');
      }
      if (/\bERR\b/.test(line)) console.error(line);
    }
  };
  child.stdout.on('data', output); child.stderr.on('data', output);
  child.on('error', (error) => { console.error(`Tunnel impossible : ${error.message}`); stop(1); });
  child.on('exit', (code) => { if (!stopping) { console.error(`Tunnel fermé (code ${code}).`); stop(code || 0); } });
});
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
