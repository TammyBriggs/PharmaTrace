import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/batch_model.dart';

class ScanRecord {
  final DrugBatch batch;
  final DateTime scanTime;

  ScanRecord({required this.batch, required this.scanTime});

  Map<String, dynamic> toJson() => {
        'batch': batch.toJson(),
        'scanTime': scanTime.toUtc().toIso8601String(),
      };

  factory ScanRecord.fromJson(Map<String, dynamic> json) => ScanRecord(
        batch: DrugBatch.fromJson(Map<String, dynamic>.from(json['batch'] as Map)),
        scanTime: DateTime.parse(json['scanTime'] as String),
      );
}

class ScanHistoryManager {
  // v2: results now come from the live server. Older saved demo results are ignored.
  static const String _storageKey = 'persistent_scan_history_v2';
  static const String _oldKey = 'persistent_scan_history_v1';

  static final ScanHistoryManager _instance = ScanHistoryManager._internal();
  factory ScanHistoryManager() => _instance;
  ScanHistoryManager._internal();

  List<ScanRecord> _scans = [];
  bool _isInitialized = false;

  // Load history from local SharedPreferences on startup
  Future<void> init() async {
    if (_isInitialized) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_oldKey);
    final String? jsonString = prefs.getString(_storageKey);
    if (jsonString != null) {
      try {
        final List<dynamic> decoded = jsonDecode(jsonString) as List<dynamic>;
        _scans = decoded
            .map((item) => ScanRecord.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
      } catch (e) {
        _scans = [];
      }
    }
    _isInitialized = true;
  }

  // Returns scans with the newest at the top
  List<ScanRecord> get scans => _scans.reversed.toList();

  /// Saves a result. Scanning the same code again moves it to the top.
  /// Each pack (and each batch-level code) is its own entry.
  Future<void> addScan(DrugBatch batch) async {
    await init();
    _scans.removeWhere((record) => record.batch.code == batch.code);
    _scans.add(ScanRecord(batch: batch, scanTime: DateTime.now().toUtc()));

    // Limit history cache to last 50 items to optimize performance
    if (_scans.length > 50) {
      _scans = _scans.sublist(_scans.length - 50);
    }
    await _saveToDisk();
  }

  /// Replaces a saved result in place (for example after the pack is dispensed).
  Future<void> updateScan(DrugBatch batch) async {
    await init();
    final index = _scans.indexWhere((record) => record.batch.code == batch.code);
    if (index == -1) return;
    _scans[index] = ScanRecord(batch: batch, scanTime: _scans[index].scanTime);
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
