// Gasabo District's 15 sectors (the pilot area). The mobile app offers exactly this list in a drop-down;
// the server enforces it too, so a hand-made request cannot store anything else.
//
// lat/lng are the approximate middle of each sector. They are used only to place one marker per sector on the
// regulator's risk map. No scan stores coordinates, so the map can never point at a house or a single pharmacy.
const GASABO_SECTORS = [
  { name: 'Bumbogo',    lat: -1.8420, lng: 30.1330 },
  { name: 'Gatsata',    lat: -1.9010, lng: 30.0560 },
  { name: 'Gikomero',   lat: -1.8850, lng: 30.2200 },
  { name: 'Gisozi',     lat: -1.9150, lng: 30.0650 },
  { name: 'Jabana',     lat: -1.8650, lng: 30.0700 },
  { name: 'Jali',       lat: -1.8750, lng: 30.1300 },
  { name: 'Kacyiru',    lat: -1.9370, lng: 30.0700 },
  { name: 'Kimihurura', lat: -1.9500, lng: 30.0850 },
  { name: 'Kimironko',  lat: -1.9460, lng: 30.1270 },
  { name: 'Kinyinya',   lat: -1.8950, lng: 30.0900 },
  { name: 'Ndera',      lat: -1.9050, lng: 30.1750 },
  { name: 'Nduba',      lat: -1.8400, lng: 30.0500 },
  { name: 'Remera',     lat: -1.9560, lng: 30.1130 },
  { name: 'Rusororo',   lat: -1.9250, lng: 30.2000 },
  { name: 'Rutunga',    lat: -1.8800, lng: 30.1650 },
];

const BY_KEY = new Map(GASABO_SECTORS.map((s) => [s.name.toLowerCase(), s]));

/** "remera", "Remera sector", " REMERA " -> "Remera"; anything not in the list -> null. */
function normalizeSector(value) {
  if (value === undefined || value === null) return null;
  const key = String(value).trim().toLowerCase().replace(/\s+sector$/, '');
  return BY_KEY.get(key)?.name ?? null;
}

const sectorInfo = (name) => BY_KEY.get(String(name || '').toLowerCase()) ?? null;

module.exports = { GASABO_SECTORS, normalizeSector, sectorInfo };
