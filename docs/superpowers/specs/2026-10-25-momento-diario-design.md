# Momento del día y cupo por rollo — diseño (borrador)

Estado: decisiones de producto tomadas el 25/10/2026. Falta el diseño técnico (app + backend) y cerrar las
preguntas abiertas.

## 1. Momento del día (estilo BeReal)

Una vez por día del rollo, a cada miembro le llega un aviso a una hora random para sacar **una foto extra**.

Decisiones:

- **Aparte del cupo:** no descuenta fotos del cupo del rollo (sea diario o total, ver 2).
- **Ventana de 5 minutos** desde el aviso. Pasado ese tiempo, el momento de ese día se pierde: no se puede
  sacar y no existe "tardía".
- **Hora distinta para cada uno**, no la misma para todo el grupo.
- **Selfie configurable por rollo:** al crear el rollo el admin elige si el momento es foto + selfie o solo foto.
- **Franja horaria:** por defecto entre las 9:00 y las 23:00 (hora del rollo, `trip.timezone`), configurable
  al crear el rollo. Nunca avisa fuera de la franja.
- **En el revelado:** va mezclada con las demás fotos (galería, mapa, historias), con un **badge** que la
  distingue (a definir).
- **Funciona sin señal:** el aviso es una **notificación local** programada en el celular, no una push. Igual
  **queda registrado en el backend** (qué momento le toca a cada uno, cuándo y si lo sacó). Falta diseñar
  cómo se planifican y se sincronizan esos momentos.
- **Se puede apagar** en Ajustes → Notificaciones, como los demás avisos.
- **La selfie es una foto aparte, vinculada a la principal**, nunca pegada en la imagen: así la principal se
  imprime limpia y el fotolibro elige qué usar (la principal sola, las dos lado a lado o la selfie de recuadro).
  En la app se **muestra como recuadro encima** (visor e historias, arriba a la izquierda; tocarlo intercambia
  las dos), y ese recuadro hace de badge del momento. En la galería y el mapa cuenta como una sola foto (la
  principal, con un badge chico). En la cola offline son dos archivos normales; la selfie dice de qué foto es.
- **Sin selfie** (el admin la apagó), el badge es un ícono chico en la esquina (a definir), como la insignia de
  autor en la grilla de destacadas.

Preguntas abiertas:

- **Planificación (lo próximo a diseñar):** la propuesta es que el server sortee y guarde los momentos de cada
  miembro y la app los baje y programe como notificaciones locales. La foto queda en la cola offline como
  cualquier otra y el server valida que la hora de captura cayó dentro de la ventana. Falta definir cuántos
  días se programan por adelantado (iOS permite 64 notificaciones locales pendientes), qué pasa si se apaga
  el aviso o se cambia la config, y si el reloj del celular está mal.
- **Cámara:** con selfie hace falta cámara propia (`react-native-vision-camera` o `expo-camera`) para sacar
  las dos seguidas; solo foto podría seguir con la cámara del sistema. ¿Una cámara para los dos casos?
- **Cuenta regresiva:** ¿la cámara muestra el tiempo que queda de los 5 minutos?
- **Caption:** ¿lleva caption como las demás?
- **El badge sin selfie:** qué ícono y cómo se ve en la galería, el visor, el mapa y las historias.
- **Días parciales:** si el rollo arranca a las 20:00, ¿hay momento ese día (solo si queda franja después del
  inicio)?
- **Cambiar la config:** ¿se puede editar con el rollo en curso?

## 2. Cupo diario o total

Al crear el rollo el admin elige el tipo de cupo:

- **Diario** (como hoy, por defecto 10 fotos por persona por día).
- **Total del viaje:** por ejemplo 20 fotos por persona para todo el rollo, sin límite por día.

Preguntas abiertas:

- **Sin videos:** se decidió sacar los videos de la app (próximo build), así que el cupo, diario o total, es
  solo de fotos.
- Cómo se muestra: la badge de la cámara, "Te quedan N" y "Hoy" en el tablero dicen hoy cupo del día. Con
  cupo total pasan a "Te quedan N en el rollo".
- La pantalla "Se terminó el rollo de hoy" cambia de texto con cupo total ("Ya usaste todas tus fotos del
  rollo").
- El cálculo offline (`quota.ts`, `remaining`) cuenta pendientes del día; con cupo total tiene que contar
  todas las pendientes del rollo.
- Backend: nuevo campo en el rollo y validación del límite total.
