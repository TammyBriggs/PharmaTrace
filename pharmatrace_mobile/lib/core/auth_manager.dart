import 'package:shared_preferences/shared_preferences.dart';

class AuthManager {
  static final AuthManager _instance = AuthManager._internal();
  factory AuthManager() => _instance;
  AuthManager._internal();

  late SharedPreferences _prefs;
  bool isPharmacist = false;
  String userName = "Guest User";
  String profilePicPath = "";

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    isPharmacist = _prefs.getBool('isPharmacist') ?? false;
    userName = _prefs.getString('userName') ?? (isPharmacist ? "Pharmacist Account" : "Patient Account");
    profilePicPath = _prefs.getString('profilePicPath') ?? "";
  }

  Future<void> loginAsPharmacist() async {
    isPharmacist = true;
    userName = "Pharmacist account"; // Default from design
    await _prefs.setBool('isPharmacist', true);
    await _prefs.setString('userName', userName);
  }

  Future<void> logout() async {
    isPharmacist = false;
    userName = "Patient Account";
    await _prefs.setBool('isPharmacist', false);
    await _prefs.setString('userName', userName);
  }
}
