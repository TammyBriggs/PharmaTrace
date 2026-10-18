
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/auth_manager.dart';

class ApiService {
  static const String baseUrl = 'http://192.168.0.108:3000/api';

static Future<Map<String, dynamic>> login(
  String contact,
  String password,
) async {
  late http.Response response;

  try {
    response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contact': contact,
        'password': password,
      }),
    );
  } on http.ClientException {
    throw Exception(
      'Unable to connect to the server. Please check your connection.',
    );
  } catch (e) {
    throw Exception(
      'A network error occurred. Please try again.',
    );
  }

  // Handle the server response outside the network try-catch.
  // This prevents authentication errors from being mistaken for network errors.
  if (response.statusCode == 200) {
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  try {
    final dynamic decoded = jsonDecode(response.body);

    final String? error = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;

    if (error != null && error.isNotEmpty) {
      throw Exception(error);
    }
  } on FormatException {
    // The server did not return valid JSON.
  }

  switch (response.statusCode) {
    case 400:
      throw Exception('Please check the information you entered.');
    case 401:
      throw Exception('Invalid contact or password.');
    case 403:
      throw Exception('You are not authorized to sign in.');
    case 404:
      throw Exception('Login service not found.');
    case 429:
      throw Exception('Too many attempts. Please try again later.');
    default:
      if (response.statusCode >= 500) {
        throw Exception('Server error. Please try again later.');
      }

      throw Exception(
        'Login failed. Please try again. '
        '(Error ${response.statusCode})',
      );
  }
}

  // Submit a report with an optional image attachment.
  static Future<void> submitReport(
    String batchId,
    String reason,
    String? imagePath,
  ) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/reports'),
      );

      // Attach JWT token for authentication.
      final token = AuthManager().jwtToken;

      if (token == null || token.isEmpty) {
        throw Exception('You must be logged in to submit a report.');
      }

      request.headers['Authorization'] = 'Bearer $token';

      request.fields['batch_id'] = batchId;
      request.fields['reason'] = reason;

      // Attach image file if selected.
      if (imagePath != null && imagePath.isNotEmpty) {
        request.files.add(
          await http.MultipartFile.fromPath('image', imagePath),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 201) {
        final dynamic decoded = jsonDecode(response.body);

        final error = decoded is Map<String, dynamic>
            ? decoded['error']
            : null;

        throw Exception(error ?? 'Failed to submit report');
      }
    } catch (e) {
      throw Exception('Report submission error: $e');
    }
  }
}
