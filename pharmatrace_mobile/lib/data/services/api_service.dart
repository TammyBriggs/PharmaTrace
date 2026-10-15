import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'http://192.168.1.81:3000/api';

  static Future<Map<String, dynamic>> login(String contact, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'contact': contact,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body); // Returns the token and user data
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['error'] ?? 'Login failed');
      }
    } catch (e) {
      throw Exception('Network error: Ensure your Node.js server is running and accessible.');
    }
  }
}