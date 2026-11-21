// Calendario de eventos de ofertas en Argentina.
// Las fechas son ESTIMADAS a partir de cómo se repiten cada año.
// La detección real de cada evento la hacen los chequeos de las portadas de las tiendas.

function nthWeekdayOfMonth(year, month, weekday, n) {
  // month: 0-11, weekday: 0=domingo ... 6=sábado
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function eventsForYear(year) {
  const hotSaleStart = nthWeekdayOfMonth(year, 4, 1, 2); // 2º lunes de mayo
  const cyberStart = nthWeekdayOfMonth(year, 10, 1, 1); // 1º lunes de noviembre
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4º jueves de noviembre
  const blackFriday = addDays(thanksgiving, 1);
  const padre = nthWeekdayOfMonth(year, 5, 0, 3); // 3º domingo de junio
  const nino = nthWeekdayOfMonth(year, 7, 0, 3); // 3º domingo de agosto
  const madre = nthWeekdayOfMonth(year, 9, 0, 3); // 3º domingo de octubre

  return [
    { id: `hotsale-${year}`, name: "Hot Sale", start: hotSaleStart, end: addDays(hotSaleStart, 2), url: "https://www.hotsale.com.ar/", estimated: true },
    { id: `padre-${year}`, name: "Ofertas Día del Padre", start: addDays(padre, -10), end: padre, url: null, estimated: true },
    { id: `nino-${year}`, name: "Ofertas Día del Niño (consolas y juegos)", start: addDays(nino, -10), end: nino, url: null, estimated: true },
    { id: `madre-${year}`, name: "Ofertas Día de la Madre", start: addDays(madre, -7), end: madre, url: null, estimated: true },
    { id: `cyber-${year}`, name: "CyberMonday Argentina", start: cyberStart, end: addDays(cyberStart, 2), url: "https://www.cybermonday.com.ar/", estimated: true },
    { id: `bf-${year}`, name: "Black Friday", start: blackFriday, end: addDays(blackFriday, 3), url: null, estimated: true },
    { id: `navidad-${year}`, name: "Ofertas de Navidad", start: new Date(year, 11, 10), end: new Date(year, 11, 24), url: null, estimated: true }
  ];
}

export function upcomingEvents(now = new Date(), count = 6) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const all = [...eventsForYear(now.getFullYear()), ...eventsForYear(now.getFullYear() + 1)];
  return all
    .filter((e) => e.end >= today)
    .sort((a, b) => a.start - b.start)
    .slice(0, count)
    .map((e) => ({
      ...e,
      active: e.start <= now && now <= addDays(e.end, 1),
      daysUntil: Math.ceil((e.start - today) / 86400000)
    }));
}

export function formatDate(d) {
  return new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
