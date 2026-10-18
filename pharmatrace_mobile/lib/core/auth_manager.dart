import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthManager {
  static final AuthManager _instance = AuthManager._internal();
  factory AuthManager() => _instance;
  AuthManager._internal();

  late SharedPreferences _prefs;
  bool isPharmacist = false;
  String userName = "Guest User";
  String profilePicPath = "";
  String pharmacistSector = "Remera sector";
  String? jwtToken;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    isPharmacist = _prefs.getBool('isPharmacist') ?? false;
    userName = _prefs.getString('userName') ?? (isPharmacist ? "Pharmacist Account" : "Patient Account");
    profilePicPath = _prefs.getString('profilePicPath') ?? "";
    pharmacistSector = _prefs.getString('pharmacistSector') ?? "Remera sector";
    jwtToken = _prefs.getString('jwtToken');
  }

  Future<void> loginAsPharmacist(String token, String name, String? sector, String? picUrl) async {
    isPharmacist = true;
    userName = name;
    jwtToken = token;
    if (sector != null) pharmacistSector = sector;
    if (picUrl != null) profilePicPath = picUrl;

    await _prefs.setBool('isPharmacist', true);
    await _prefs.setString('userName', name);
    await _prefs.setString('jwtToken', token);
    await _prefs.setString('pharmacistSector', pharmacistSector);
    if (picUrl != null) await _prefs.setString('profilePicPath', picUrl);
  }

  Future<void> updateProfile({String? name, String? picPath, String? sector}) async {
    if (isPharmacist && jwtToken != null) {
      // Sync pharmacist updates with backend
      var request = http.MultipartRequest('PUT', Uri.parse('http://192.168.0.108:3000/api/auth/profile'));
      request.headers['Authorization'] = 'Bearer $jwtToken';
      if (name != null) request.fields['name'] = name;
      if (sector != null) request.fields['sector'] = sector;
      if (picPath != null && !picPath.startsWith('http')) {
        request.files.add(await http.MultipartFile.fromPath('profile_pic', picPath));
      }

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final user = data['user'];
        userName = user['name'] ?? userName;
        pharmacistSector = user['sector'] ?? pharmacistSector;
        if (user['profile_pic_url'] != null) profilePicPath = user['profile_pic_url'];
      } else {
        throw Exception('Failed to update backend profile');
      }
    } else {
      // Local storage fallback for anonymous patients
      if (name != null) userName = name;
      if (sector != null) pharmacistSector = sector;
      if (picPath != null) profilePicPath = picPath;
    }

    await _prefs.setString('userName', userName);
    await _prefs.setString('pharmacistSector', pharmacistSector);
    await _prefs.setString('profilePicPath', profilePicPath);
  }

  Future<void> logout() async {
    isPharmacist = false;
    userName = "Patient Account";
    jwtToken = null;
    profilePicPath = "";
    await _prefs.setBool('isPharmacist', false);
    await _prefs.setString('userName', userName);
    await _prefs.remove('jwtToken');
    await _prefs.remove('profilePicPath');
  }
}