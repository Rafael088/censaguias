---
id: pro-seei
fecha: 2026-10-22
temas: [cotejo, windows, pruebas]
estado: abierto
---
# Pruebas --prueba con npm fallan con WinError 2 en Windows

cotejo entregar corre los --prueba sin shell y en Windows npm solo existe como npm.cmd/npm.ps1, asi que anota «WinError 2: El sistema no puede encontrar el archivo especificado» aunque el comando sea correcto. Solucion: usar la ruta completa a npm.cmd sin espacios en la ruta (p. ej. un junction hacia 'C:\Program Files\nodejs') o invocar node.exe directamente. Ocurrio al entregar WEB-01 en censaguias (2026-10-22); 'npm run typecheck' y 'npm test' pasaron en verde ejecutados a mano.
