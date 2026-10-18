import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/batch_model.dart';

class ScanHistoryStorage {
  static const String _storageKey = 'local_scan_history';

  static Future<List<DrugBatch>> getStoredHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final String? jsonString = prefs.getString(_storageKey);
    if (jsonString == null) return [];

    try {
      final List<dynamic> decodedList = jsonDecode(jsonString);
      return decodedList.map((item) => DrugBatch.fromJson(item)).toList();
    } catch (e) {
      return [];
    }
  }

  static Future<void> saveScan(DrugBatch batch) async {
    final prefs = await SharedPreferences.getInstance();
    List<DrugBatch> currentHistory = await getStoredHistory();

    // Remove duplicate if already exists, then insert at the top (most recent)
    currentHistory.removeWhere((item) => item.batchId == batch.batchId);
    currentHistory.insert(0, batch);

    // Limit history cache to last 50 items
    if (currentHistory.length > 50) {
      currentHistory = currentHistory.sublist(0, 50);
    }

    final List<Map<String, dynamic>> jsonList = currentHistory.map((item) => item.toJson()).toList();
    await prefs.setString(_storageKey, jsonEncode(jsonList));
  }
}