import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/batch_model.dart';
import 'scan_history_manager.dart';

class MockDataService {
  static Future<DrugBatch> verifyBatch(String batchId) async {
    // Artificial 1.5-second delay to trigger skeleton loaders
    await Future.delayed(const Duration(milliseconds: 1500));

    final String response = await rootBundle.loadString('assets/data/mock_fda_data.json');
    final Map<String, dynamic> data = json.decode(response);
    final List<dynamic> batches = data['batches'];

    final result = batches.firstWhere(
      (b) => b['batchId'] == batchId,
      orElse: () => null,
    );

    late DrugBatch fetchedBatch;

    if (result != null) {
      fetchedBatch = DrugBatch.fromJson(result);
    } else {
      // Return a default "Not Found" state if the QR code is unregistered
      fetchedBatch = DrugBatch(
        batchId: batchId,
        drugName: 'Unknown Product',
        activeIngredient: 'N/A',
        manufacturerName: 'Unverified Source',
        location: 'N/A',
        verdict: BatchVerdict.notFound,
      );
    }

    // Save the scan to our dynamic history manager
    ScanHistoryManager().addScan(fetchedBatch);
    return fetchedBatch;
  }
}