import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export function createVisualBridge({ script = 'engine.py' } = {}) {
  const python = fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe', import.meta.url));
  const child = spawn(python, [fileURLToPath(new URL(script, import.meta.url))], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); let counter = 0, closed = false;
  const stop = (error = new Error('Moteur visuel arrêté.')) => {
    if (closed) return; closed = true; child.kill();
    for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
    pending.clear();
  };
  child.on('error', () => stop(new Error('Environnement visuel indisponible.')));
  child.stdin.on('error', () => stop(new Error('Moteur visuel indisponible.')));
  child.on('exit', () => stop(new Error('Moteur visuel indisponible.')));
  child.stderr.on('data', () => {}); // no images, request data or tracebacks in logs
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const packet = JSON.parse(line), job = pending.get(packet.id); if (!job) return;
      pending.delete(packet.id); clearTimeout(job.timer);
      if (packet.error) job.reject(new Error(packet.error)); else job.resolve(packet.result);
    } catch { stop(new Error('Réponse du moteur invalide.')); }
  });
  return {
    close: stop,
    request(action, payload = {}) {
      if (closed) return Promise.reject(new Error('Moteur visuel arrêté.'));
      if (pending.size) return Promise.reject(new Error('Une analyse est déjà en cours. Réessaie.'));
      const id = ++counter;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => stop(new Error('Analyse visuelle trop longue.')), 20000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ id, action, ...payload })}\n`);
      });
    },
  };
}
