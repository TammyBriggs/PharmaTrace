class AppConfig {
  static const String _raw = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://chomp-armhole-scorebook.ngrok-free.dev/api', // Physical Device
  );

  /// The server address with "/api" on the end, so `--dart-define=API_BASE_URL=https://xyz.ngrok-free.dev`
  /// works the same as `.../api`.
  static String get apiBaseUrl {
    var url = _raw.trim();
    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url.endsWith('/api') ? url : '$url/api';
  }
}
