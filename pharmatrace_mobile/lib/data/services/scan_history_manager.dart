import '../models/batch_model.dart';

class ScanRecord {
  final DrugBatch batch;
  final DateTime scanTime;

  ScanRecord({required this.batch, required this.scanTime});
}

class ScanHistoryManager {
  // Singleton pattern to keep data alive across screens
  static final ScanHistoryManager _instance = ScanHistoryManager._internal();
  factory ScanHistoryManager() => _instance;
  ScanHistoryManager._internal();

  final List<ScanRecord> _scans = [];

  // Returns scans with the newest at the top
  List<ScanRecord> get scans => _scans.reversed.toList();

  void addScan(DrugBatch batch) {
    _scans.add(ScanRecord(batch: batch, scanTime: DateTime.now()));
  }
}