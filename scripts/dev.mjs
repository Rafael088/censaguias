// Arranca la API y la web a la vez. `npm run dev --workspaces` las corre en serie y el
// `watch` de la API no termina nunca, así que la web no llegaba a arrancar.
// Sin `&` ni dependencias para que funcione igual en Windows.
import { spawn, spawnSync } from "node:child_process";

const windows = process.platform === "win32";
const apps = ["dev:api", "dev:web"];
// Cada app en su propio grupo de procesos: matar solo a npm dejaría vivos a next y a tsx.
const hijos = apps.map((script) =>
  spawn("npm", ["run", script], { stdio: "inherit", shell: windows, detached: !windows }),
);

function matar(hijo) {
  if (hijo.exitCode !== null || hijo.pid === undefined) return;
  try {
    if (windows) spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"]);
    else process.kill(-hijo.pid, "SIGTERM");
  } catch {
    // Ya había terminado.
  }
}

let saliendo = false;
function parar(codigo) {
  if (saliendo) return;
  saliendo = true;
  hijos.forEach(matar);
  process.exitCode = codigo;
}

// Si una de las dos se cae, se paran las dos: media app levantada confunde más que ninguna.
for (const hijo of hijos) hijo.on("exit", (codigo) => parar(codigo ?? 1));
for (const senal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(senal, () => parar(0));
