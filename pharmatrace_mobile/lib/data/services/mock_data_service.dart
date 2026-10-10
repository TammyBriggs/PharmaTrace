import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/batch_model.dart';

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

    if (result != null) {
      return DrugBatch.fromJson(result);
    } 
    
    // Return a default "Not Found" state if the QR code is unregistered[cite: 3]
    return DrugBatch(
      batchId: batchId,
      drugName: 'Unknown Product',
      activeIngredient: 'N/A',
      manufacturerName: 'Unverified Source',
      location: 'N/A',
      verdict: BatchVerdict.notFound,
    );
  }
}
