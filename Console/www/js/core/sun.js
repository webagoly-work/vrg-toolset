/* Sunrise and sunset by the standard sunrise equation; good to a few minutes, which is all a site
   visit needs. lon is positive to the east. */
const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const TILT = 23.4397;
const HORIZON = -0.833;
const J1970 = 2440587.5;
const J2000 = 2451545;

const toDate = (j) => new Date((j - J1970) * 864e5);

/* date: any Date on the wanted calendar day, in local time.
   Returns { rise, set, length (ms), polar: null | 'day' | 'night' }. */
export function sunTimes(date, lat, lon) {
  const noon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 864e5 + J1970;
  const js = noon - J2000 + 0.0008 - lon / 360;
  const m = (357.5291 + 0.98560028 * js) % 360;
  const c = 1.9148 * sin(m) + 0.02 * sin(2 * m) + 0.0003 * sin(3 * m);
  const l = (m + c + 180 + 102.9372) % 360;
  const transit = J2000 + js + 0.0053 * sin(m) - 0.0069 * sin(2 * l);
  const sd = sin(l) * sin(TILT);
  const cd = Math.sqrt(1 - sd * sd);
  const ch = (sin(HORIZON) - sin(lat) * sd) / (cos(lat) * cd);
  if (ch > 1) return { rise: null, set: null, length: 0, polar: 'night' };
  if (ch < -1) return { rise: null, set: null, length: 864e5, polar: 'day' };
  const w = Math.acos(ch) / RAD;
  const rise = toDate(transit - w / 360);
  const set = toDate(transit + w / 360);
  return { rise, set, length: set - rise, polar: null };
}
