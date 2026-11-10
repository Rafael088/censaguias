---
id: apr-jdu8
fecha: 2026-10-22
temas: [herramientas, proceso]
---
# En Windows las pruebas de Cotejo hay que invocarlas con cmd /c

cotejo entregar --prueba corre el comando SIN shell. En Windows el binario de npm es npm.cmd, no npm, asi que 'npm test' muere con [WinError 2] antes de arrancar y queda anotado como prueba fallida en la entrega (y no se puede sobrescribir: entregar sobre una tarea ya entregada devuelve cambio:false). La forma correcta aqui es --prueba 'cmd /c npm test' y --prueba 'cmd /c npm run typecheck'. Afecta a toda entrega de este repo en esta maquina.
