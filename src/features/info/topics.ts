export type InfoTopic = { id: string; title: string; body: string };

/** Every "i" explanation of the app, in one place. Paragraphs are separated by a blank line. */
const topics = {
  dates: {
    id: "dates",
    title: "Fechas y hora",
    body:
      "El rollo empieza y termina en la fecha y la hora que elijas. Con \"Ahora\" empieza apenas lo creás.\n\n" +
      "Las horas son las de la zona horaria de tu celular, y esa zona es la que usa el rollo para sus días.",
  },
  reveal: {
    id: "reveal",
    title: "Revelado",
    body:
      "El rollo se revela en el momento que elijas, igual o después del fin. Hasta ahí nadie ve ninguna foto, ni las propias.\n\n" +
      "Con \"Al terminar\" se revela justo cuando termina. La única excepción es el momento del día, que se ve apenas se sube.",
  },
  quota: {
    id: "quota",
    title: "Fotos por persona",
    body:
      "Cada persona tiene un cupo de fotos. Con \"Por día\" se renueva a la medianoche; con \"Todo el rollo\" es un total para todo el rollo y no se renueva.\n\n" +
      "El momento del día no gasta cupo.",
  },
  moment: {
    id: "moment",
    title: "Momento del día",
    body:
      "Una vez por día la app le avisa a cada uno, a una hora al azar y distinta para cada persona, dentro de la franja que elijas. Desde el aviso hay 5 minutos para sacar una foto extra (con \"Dos cámaras\", una con cada cámara). Pasado ese tiempo se pierde.\n\n" +
      "Se ve en el Feed apenas se sube, antes del revelado. El aviso suena aunque no tengas señal.",
  },
  momentWindow: {
    id: "momentWindow",
    title: "Franja del momento",
    body:
      "El aviso de cada día llega a una hora al azar entre \"Desde\" y \"Hasta\". Cada persona recibe el suyo a una hora distinta.\n\n" +
      "Son horas de la zona horaria del rollo. Por defecto, de 9:00 a 23:00.",
  },
  privateRollo: {
    id: "privateRollo",
    title: "Rollo privado",
    body:
      "En un rollo privado ninguna foto puede mostrarse en un perfil, ni las de quien la sacó.\n\n" +
      "Después lo podés cambiar desde el tablero del rollo. Si lo hacés privado, se sacan las fotos que ya estaban en perfiles y no vuelven solas.",
  },
  publicProfile: {
    id: "publicProfile",
    title: "Perfil público",
    body:
      "Con el perfil público, cualquiera puede ver tus fotos destacadas y tu lista de amigos. Si lo apagás, solo las ven tus amigos.\n\n" +
      "Tu nombre, tu @usuario, tu foto, tu descripción y cuántos amigos tenés se ven siempre.",
  },
  othersProfiles: {
    id: "othersProfiles",
    title: "Tus fotos en otros perfiles",
    body:
      "Cuando un rollo se revela, cada uno puede destacar fotos en su perfil, también las de otros. Acá decidís si los demás pueden destacar las tuyas.\n\n" +
      "Si lo apagás, las tuyas que ya estaban en otros perfiles se sacan, y si lo prendés de nuevo no vuelven solas. Vos siempre podés destacar las tuyas.",
  },
  offlineMap: {
    id: "offlineMap",
    title: "Mapa sin señal",
    body:
      "Para que el mapa ande donde no hay señal, la app baja sola partes del mapa alrededor de donde estás y de donde sacó fotos el grupo. Lo hace al abrir la app y al volver a ella, desde unos días antes del inicio hasta el fin del rollo.\n\n" +
      "Antes del inicio baja solo con Wi‑Fi. Es un ajuste de este celular y se borra una semana después de que termina el rollo.",
  },
  inviteCode: {
    id: "inviteCode",
    title: "Código para invitar",
    body:
      "Con este código de 6 caracteres se suma cualquiera al rollo: pasáselo o tocá \"Compartir invitación\".\n\n" +
      "Quien lo recibe elige \"Sumarme con un código\" y lo escribe. Si es tu amigo, también podés sumarlo desde \"Sumar amigos\".",
  },
} as const satisfies Record<string, InfoTopic>;

export type InfoTopicId = keyof typeof topics;
export const INFO_TOPICS: Record<InfoTopicId, InfoTopic & { id: InfoTopicId }> = topics;

export function isInfoTopicId(value: unknown): value is InfoTopicId {
  return typeof value === "string" && Object.hasOwn(INFO_TOPICS, value);
}

/** The topic for a route param, or undefined when it isn't a known one. */
export function infoTopic(id: string | string[] | undefined): (InfoTopic & { id: InfoTopicId }) | undefined {
  return isInfoTopicId(id) ? INFO_TOPICS[id] : undefined;
}
