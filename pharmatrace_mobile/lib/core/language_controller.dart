import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLanguage { en, rw }

/// Remembers whether the app speaks English or Kinyarwanda. English is the default.
/// The app listens to it (see main.dart), so the switch in Settings changes every screen at once.
class LanguageController extends ChangeNotifier {
  static final LanguageController _instance = LanguageController._internal();
  factory LanguageController() => _instance;
  LanguageController._internal();

  static const String _key = 'appLanguage';

  AppLanguage _language = AppLanguage.en;

  AppLanguage get language => _language;
  bool get isKinyarwanda => _language == AppLanguage.rw;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _language = prefs.getString(_key) == 'rw' ? AppLanguage.rw : AppLanguage.en;
  }

  Future<void> setLanguage(AppLanguage value) async {
    if (value == _language) return;
    _language = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, value == AppLanguage.rw ? 'rw' : 'en');
  }
}
