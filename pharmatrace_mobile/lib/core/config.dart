class AppConfig {
  static const String _raw = String.fromEnvironment(
    'API_BASE_URL',
    // The hosted backend. Override with --dart-define=API_BASE_URL=... for a local server or an ngrok tunnel.
    defaultValue: 'https://pharmatrace-v2.onrender.com/api',
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
