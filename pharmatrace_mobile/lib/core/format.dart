const List<String> _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String _two(int n) => n.toString().padLeft(2, '0');

/// "2028-01-10" -> "10 Jan 2028". Returns the input unchanged if it is not a date.
String fmtDay(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final parts = iso.split('-');
  if (parts.length != 3) return iso;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null || m < 1 || m > 12) return iso;
  return '${_two(d)} ${_months[m - 1]} $y';
}

/// Rwanda is UTC+2 all year (no daylight saving), so Kigali time is a fixed offset.
DateTime toKigali(DateTime t) => t.toUtc().add(const Duration(hours: 2));

/// "02 Nov 2026, 13:47 CAT", whatever the phone's own time zone is.
String fmtKigaliDateTime(DateTime t) {
  final k = toKigali(t);
  return '${_two(k.day)} ${_months[k.month - 1]} ${k.year}, ${_two(k.hour)}:${_two(k.minute)} CAT';
}
