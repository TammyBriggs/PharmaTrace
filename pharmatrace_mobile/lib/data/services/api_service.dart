import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../core/auth_manager.dart';
import '../../core/config.dart';
import '../models/batch_history.dart';
import '../models/batch_model.dart';

/// An error with a message that is safe to show to the user.
class ApiException implements Exception {
  final String message;
  final int? status;

  /// Machine-readable reason from the server, e.g. ALREADY_DISPENSED.
  final String? code;

  ApiException(this.message, {this.status, this.code});

  @override
  String toString() => message;
}

/// The batch number typed by hand is used by more than one product.
/// The person picks theirs from [matches] and the check runs again with its GTIN.
class AmbiguousBatchException implements Exception {
  final String message;
  final List<({String gtin, String drugName, String manufacturer})> matches;

  AmbiguousBatchException(this.message, this.matches);

  @override
  String toString() => message;
}

class ApiService {
  static String get baseUrl => AppConfig.apiBaseUrl;

  static Future<Map<String, dynamic>> login(
    String contact,
    String password,
  ) async {
    late http.Response response;

    try {
      response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'},
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

  static const Duration _timeout = Duration(seconds: 20);

  static const String _offline =
      'Unable to connect to the server. Please check your connection.';

  /// Runs a request and turns connection problems into readable errors.
  static Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(_timeout);
    } on TimeoutException {
      throw ApiException('The server at ${Uri.parse(baseUrl).host} took too long to respond. Please try again.');
    } on SocketException {
      throw ApiException(_offline);
    } on http.ClientException {
      throw ApiException(_offline);
    }
  }

  /// The server's own error text when it sent one.
  static ({String? message, String? code}) _readError(http.Response response) {
    try {
      final dynamic decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['error']?.toString();
        final code = decoded['code']?.toString();
        return (
          message: (message != null && message.isNotEmpty) ? message : null,
          code: code,
        );
      }
    } on FormatException {
      // Not JSON: fall back to a generic message.
    }
    return (message: null, code: null);
  }

  static Map<String, String> _authHeaders({bool json = false}) {
    // Lets requests through ngrok's free-plan browser warning page when testing via a tunnel.
    final headers = <String, String>{'ngrok-skip-browser-warning': 'true'};
    final token = AuthManager().jwtToken;
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  /// Sets a new password while signed in. Works with the restricted token from a
  /// temporary-password sign-in. Returns the normal token that replaces it.
  static Future<String> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _send(
      () => http.post(
        Uri.parse('$baseUrl/auth/change-password'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'currentPassword': currentPassword, 'newPassword': newPassword}),
      ),
    );
    if (response.statusCode == 200) {
      try {
        final token = (jsonDecode(response.body) as Map<String, dynamic>)['token'];
        if (token is String && token.isNotEmpty) return token;
      } on FormatException {
        // handled below
      }
      throw ApiException('The password was changed, but the server sent no new session. Please sign in again.');
    }
    final err = _readError(response);
    throw ApiException(
      err.message ??
          (response.statusCode == 429
              ? 'Too many attempts. Please try again later.'
              : response.statusCode >= 500
                  ? 'Server error. Please try again later.'
                  : 'Could not change the password. (Error ${response.statusCode})'),
      status: response.statusCode,
    );
  }

  /// Asks the server to email a 6-digit reset code. The answer is always the same,
  /// whether or not the address belongs to an account.
  static Future<void> requestResetCode(String email) async {
    final response = await _send(
      () => http.post(
        Uri.parse('$baseUrl/auth/forgot-password'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'contact': email}),
      ),
    );
    if (response.statusCode == 200) return;
    final err = _readError(response);
    throw ApiException(
      err.message ??
          (response.statusCode == 429
              ? 'Too many requests. Please wait a few minutes and try again.'
              : 'Could not send a code. (Error ${response.statusCode})'),
      status: response.statusCode,
    );
  }

  /// Sets a new password using the emailed code.
  static Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final response = await _send(
      () => http.post(
        Uri.parse('$baseUrl/auth/reset-password'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'contact': email, 'code': code, 'newPassword': newPassword}),
      ),
    );
    if (response.statusCode == 200) return;
    final err = _readError(response);
    throw ApiException(
      err.message ??
          (response.statusCode == 429
              ? 'Too many attempts. Please wait a few minutes and try again.'
              : 'Could not reset the password. (Error ${response.statusCode})'),
      status: response.statusCode,
    );
  }

  /// A code typed without a GTIN looks like "/10/RW-0412" or "/10/RW-0412/21/ABCD2345EFGH".
  static final RegExp _noGtin = RegExp(r'^/10/([^/]+)(?:/21/([^/]+))?$');

  /// Checks a scanned or typed pack/batch code against the register.
  /// Works for everyone; if a pharmacist is signed in, the server also records
  /// who scanned and from which sector.
  /// Throws [AmbiguousBatchException] when a GTIN-less batch number matches several products.
  static Future<DrugBatch> verify(String code) async {
    final m = _noGtin.firstMatch(code);
    final query = m == null
        ? {'code': code}
        : {
            'batch': Uri.decodeComponent(m.group(1)!),
            if (m.group(2) != null) 'serial': m.group(2)!,
          };
    final uri = Uri.parse('$baseUrl/verify').replace(queryParameters: query);
    final response = await _send(() => http.get(uri, headers: _authHeaders()));

    if (response.statusCode == 200) {
      try {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['ambiguous'] == true) {
          final list = decoded['matches'] is List ? decoded['matches'] as List : const [];
          throw AmbiguousBatchException(
            decoded['message']?.toString() ?? 'More than one product uses this batch number.',
            [
              for (final x in list)
                if (x is Map)
                  (
                    gtin: x['gtin']?.toString() ?? '',
                    drugName: x['drugName']?.toString() ?? 'Unknown product',
                    manufacturer: x['manufacturer']?.toString() ?? '',
                  ),
            ],
          );
        }
        return DrugBatch.fromApi(decoded, code);
      } on FormatException {
        throw ApiException('The server returned an invalid response.');
      }
    }

    final err = _readError(response);
    switch (response.statusCode) {
      case 429:
        throw ApiException(err.message ?? 'Too many scans. Please wait a moment and try again.', status: 429);
      default:
        throw ApiException(
          err.message ??
              (response.statusCode >= 500
                  ? 'Server error. Please try again later.'
                  : 'Could not verify this code. (Error ${response.statusCode})'),
          status: response.statusCode,
        );
    }
  }

  /// The batch's provenance timeline (submitted, approved, flagged, ...). Public, no sign-in needed.
  static Future<BatchHistory> batchHistory({required String gtin, required String batchNo}) async {
    final uri = Uri.parse('$baseUrl/verify/history').replace(queryParameters: {'gtin': gtin, 'batch': batchNo});
    final response = await _send(() => http.get(uri, headers: _authHeaders()));

    if (response.statusCode == 200) {
      try {
        return BatchHistory.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
      } on FormatException {
        throw ApiException('The server returned an invalid response.');
      }
    }
    final err = _readError(response);
    throw ApiException(
      err.message ?? 'Could not load the batch history. (Error ${response.statusCode})',
      status: response.statusCode,
    );
  }

  /// Records that a pack was sold. Pharmacists only. Returns when the server stored it.
  /// Throws an [ApiException] whose `code` is ALREADY_DISPENSED or NOT_DISPENSABLE
  /// when the pack must not be sold.
  static Future<DateTime?> dispense(String code) async {
    final token = AuthManager().jwtToken;
    if (token == null || token.isEmpty) {
      throw ApiException('Sign in as a pharmacist to record a sale.');
    }

    final uri = Uri.parse('$baseUrl/serials/dispense');
    final response = await _send(
      () => http.post(uri, headers: _authHeaders(json: true), body: jsonEncode({'code': code})),
    );

    if (response.statusCode == 200) {
      try {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        return DateTime.tryParse(decoded['dispensedAt']?.toString() ?? '');
      } on FormatException {
        return null; // The sale was recorded; only the timestamp is unreadable.
      }
    }

    final err = _readError(response);
    if (response.statusCode == 401 || response.statusCode == 403) {
      throw ApiException(
        err.message ?? 'Your session has expired or you are not allowed to do this. Sign in again.',
        status: response.statusCode,
      );
    }
    throw ApiException(
      err.message ?? 'Could not record the sale. (Error ${response.statusCode})',
      status: response.statusCode,
      code: err.code,
    );
  }

  // Submit a report with its own location field and an optional image.
  static Future<void> submitReport(
    String batchId,
    String location,
    String reason,
    String? imagePath,
  ) async {
    final token = AuthManager().jwtToken;

    if (token == null || token.isEmpty) {
      throw ApiException('You must be logged in to submit a report.');
    }

    try {
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
          await http.MultipartFile.fromPath('image', imagePath),
        );
      }

      final streamedResponse = await request.send().timeout(const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 201) {
        final err = _readError(response);
        throw ApiException(
          err.message ?? 'Failed to submit report (Error ${response.statusCode}).',
          status: response.statusCode,
        );
      }
    } on TimeoutException {
      throw ApiException('The upload took too long. Check your connection and try again.');
    } on SocketException {
      throw ApiException(_offline);
    } on http.ClientException {
      throw ApiException(_offline);
    }
  }
}
