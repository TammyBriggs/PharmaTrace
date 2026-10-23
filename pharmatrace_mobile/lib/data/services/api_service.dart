import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/auth_manager.dart';
import '../../core/config.dart';

class ApiService {
  static const String baseUrl = AppConfig.apiBaseUrl;

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

    // Return the decoded server response on successful login.
    if (response.statusCode == 200) {
      try {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } on FormatException {
        throw Exception('The server returned an invalid response.');
      }
    }

    // Extract the server's error message when available.
    try {
      final dynamic decoded = jsonDecode(response.body);

      final String? error = decoded is Map<String, dynamic>
          ? decoded['error']?.toString()
          : null;

      if (error != null && error.isNotEmpty) {
        throw Exception(error);
      }
    } on FormatException {
      // Continue to the status-code handling below if the response
      // does not contain valid JSON.
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

  // Submit a report with its own location field and an optional image.
  static Future<void> submitReport(
    String batchId,
    String location,
    String reason,
    String? imagePath,
  ) async {
    try {
      final token = AuthManager().jwtToken;

      if (token == null || token.isEmpty) {
        throw Exception(
          'You must be logged in to submit a report.',
        );
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/reports'),
      );

      request.headers['Authorization'] = 'Bearer $token';

      // Send report details as separate multipart fields.
      request.fields['batch_id'] = batchId;
      request.fields['location'] = location;
      request.fields['reason'] = reason;

      // Attach a local image file if one was selected.
      // Remote URLs are not uploaded as local files.
      if (imagePath != null &&
          imagePath.isNotEmpty &&
          !imagePath.startsWith('http')) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'image',
            imagePath,
          ),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(
        streamedResponse,
      );

      if (response.statusCode != 201) {
        String errorMessage = 'Failed to submit report';

        try {
          final dynamic decoded = jsonDecode(response.body);

          if (decoded is Map<String, dynamic>) {
            final serverError = decoded['error']?.toString();

            if (serverError != null && serverError.isNotEmpty) {
              errorMessage = serverError;
            }
          }
        } on FormatException {
          // Keep the fallback message for invalid JSON responses.
        }

        throw Exception(errorMessage);
      }
    } catch (e) {
      // Preserve useful error details without wrapping them repeatedly.
      if (e is Exception &&
          e.toString().startsWith('Exception: Report submission error:')) {
        rethrow;
      }

      throw Exception('Report submission error: $e');
    }
  }
}