import 'package:shared_preferences/shared_preferences.dart';

class AuthManager {
  static final AuthManager _instance = AuthManager._internal();
  factory AuthManager() => _instance;
  AuthManager._internal();

  late SharedPreferences _prefs;
  bool isPharmacist = false;
  String userName = "Guest User";
  String profilePicPath = "";
  String? jwtToken; // Added to store the authentication token

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    isPharmacist = _prefs.getBool('isPharmacist') ?? false;
    userName = _prefs.getString('userName') ?? (isPharmacist ? "Pharmacist Account" : "Patient Account");
    profilePicPath = _prefs.getString('profilePicPath') ?? "";
    jwtToken = _prefs.getString('jwtToken'); // Retrieve saved token
  }

  // Updated to accept real user data from Node.js backend
  Future<void> loginAsPharmacist(String token, String name) async {
    isPharmacist = true;
    userName = name;
    jwtToken = token;
    await _prefs.setBool('isPharmacist', true);
    await _prefs.setString('userName', name);
    await _prefs.setString('jwtToken', token);
  }

  Future<void> logout() async {
    isPharmacist = false;
    userName = "Patient Account";
    jwtToken = null;
    await _prefs.setBool('isPharmacist', false);
    await _prefs.setString('userName', userName);
    await _prefs.remove('jwtToken'); // Clear the token securely
  }
}