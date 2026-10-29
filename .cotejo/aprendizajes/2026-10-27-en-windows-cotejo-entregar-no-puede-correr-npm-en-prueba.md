---
id: apr-e1ed
fecha: 2026-10-27
temas: [cotejo, windows, tests]
---
# En Windows, cotejo entregar no puede correr npm en --prueba

Los --prueba de cotejo entregar se ejecutan sin shell (subprocess con argv). En Windows npm es npm.cmd, asi que sale [WinError 2] 'El sistema no puede encontrar el archivo especificado' y la prueba queda anotada como fallida aunque el codigo este en verde. Solucion: usar comandos basados en node, que si son ejecutables directos: 'node node_modules/typescript/bin/tsc --noEmit -p <paquete>' (uno por workspace) y 'node node_modules/vitest/vitest.mjs run --root apps/api'. Comprobado en censaguias con la entrega de API-01: los cuatro comandos salen con codigo 0. Repetir entregar no reescribe (devuelve cambio:false), asi que conviene probar el comando a mano antes de entregar.
