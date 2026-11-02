/// Gasabo District's 15 sectors (the pilot area).
/// Pharmacists pick from this list so that scans and reports group cleanly by sector
/// in the regulator dashboard instead of depending on how someone typed a name.
/// To widen the pilot later, add another district to this map and nothing else changes.
const Map<String, List<String>> kigaliSectorsByDistrict = {
  'Gasabo': [
    'Bumbogo', 'Gatsata', 'Gikomero', 'Gisozi', 'Jabana', 'Jali', 'Kacyiru',
    'Kimihurura', 'Kimironko', 'Kinyinya', 'Ndera', 'Nduba', 'Remera',
    'Rusororo', 'Rutunga',
  ],
};

/// Every sector, alphabetically.
List<String> allSectors() {
  final list = kigaliSectorsByDistrict.values.expand((s) => s).toList();
  list.sort();
  return list;
}

/// District a sector belongs to, or null if the name is not in the list.
String? districtOfSector(String? sector) {
  final s = normalizeSector(sector);
  if (s == null) return null;
  for (final entry in kigaliSectorsByDistrict.entries) {
    if (entry.value.contains(s)) return entry.key;
  }
  return null;
}

/// Turns what was saved earlier ("Remera sector", "remera", "") into a list value,
/// or null when it does not match a known sector.
String? normalizeSector(String? raw) {
  if (raw == null) return null;
  var s = raw.trim();
  if (s.toLowerCase().endsWith(' sector')) {
    s = s.substring(0, s.length - ' sector'.length).trim();
  }
  if (s.isEmpty) return null;
  for (final candidate in allSectors()) {
    if (candidate.toLowerCase() == s.toLowerCase()) return candidate;
  }
  return null;
}
