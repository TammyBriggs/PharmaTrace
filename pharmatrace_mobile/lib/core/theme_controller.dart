import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Remembers whether the user wants light or dark mode.
/// The app listens to it, so flipping the switch re-themes everything at once.
class ThemeController extends ChangeNotifier {
  static final ThemeController _instance = ThemeController._internal();
  factory ThemeController() => _instance;
  ThemeController._internal();

  static const String _key = 'themeMode';

  // Light is the default: it is the palette from the Figma file.
  ThemeMode _mode = ThemeMode.light;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _mode = prefs.getString(_key) == 'dark' ? ThemeMode.dark : ThemeMode.light;
  }

  Future<void> setDark(bool value) async {
    final next = value ? ThemeMode.dark : ThemeMode.light;
    if (next == _mode) return;
    _mode = next;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, value ? 'dark' : 'light');
  }
}
