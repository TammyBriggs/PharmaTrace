import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/batch_model.dart';

class ScanRecord {
  final DrugBatch batch;
  final DateTime scanTime;

  ScanRecord({required this.batch, required this.scanTime});

  Map<String, dynamic> toJson() => {
        'batch': batch.toJson(),
        'scanTime': scanTime.toIso8601String(),
      };

  factory ScanRecord.fromJson(Map<String, dynamic> json) => ScanRecord(
        batch: DrugBatch.fromJson(json['batch']),
        scanTime: DateTime.parse(json['scanTime']),
      );
}

class ScanHistoryManager {
  static const String _storageKey = 'persistent_scan_history_v1';

  static final ScanHistoryManager _instance = ScanHistoryManager._internal();
  factory ScanHistoryManager() => _instance;
  ScanHistoryManager._internal();

  List<ScanRecord> _scans = [];
  bool _isInitialized = false;

  // Load history from local SharedPreferences on startup
  Future<void> init() async {
    if (_isInitialized) return;
    final prefs = await SharedPreferences.getInstance();
    final String? jsonString = prefs.getString(_storageKey);
    if (jsonString != null) {
      try {
        final List<dynamic> decoded = jsonDecode(jsonString);
        _scans = decoded.map((item) => ScanRecord.fromJson(item)).toList();
      } catch (e) {
        _scans = [];
      }
    }
    _isInitialized = true;
  }

  // Returns scans with the newest at the top
  List<ScanRecord> get scans => _scans.reversed.toList();

  Future<void> addScan(DrugBatch batch) async {
    await init();
    // Remove duplicate batchId if already present to bring the latest scan to the top
    _scans.removeWhere((record) => record.batch.batchId == batch.batchId);
    _scans.add(ScanRecord(batch: batch, scanTime: DateTime.now()));

    // Limit history cache to last 50 items to optimize performance
    if (_scans.length > 50) {
      _scans = _scans.sublist(_scans.length - 50);
    }
    await _saveToDisk();
  }

  Future<void> clearHistory() async {
    _scans.clear();
    await _saveToDisk();
  }

  Future<void> _saveToDisk() async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(_scans.map((s) => s.toJson()).toList());
    await prefs.setString(_storageKey, encoded);
  }
}