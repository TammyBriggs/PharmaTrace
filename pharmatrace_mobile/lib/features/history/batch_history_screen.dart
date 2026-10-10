import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../data/models/batch_model.dart';

class BatchHistoryScreen extends StatelessWidget {
  final DrugBatch batch;

  const BatchHistoryScreen({Key? key, required this.batch}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Immutable Ledger')),
      body: batch.history.isEmpty
          ? const Center(child: Text('No history found for this batch on the blockchain.'))
          : ListView.builder(
              padding: const EdgeInsets.all(24.0),
              itemCount: batch.history.length,
              itemBuilder: (context, index) {
              // Reverse the array to show chronological order (oldest top, newest bottom)
                final chronologicalHistory = batch.history.reversed.toList();
                final event = chronologicalHistory[index];
                final isLast = index == chronologicalHistory.length - 1;
                // Convert the ISO string to a local DateTime object
                final parsedDate = DateTime.parse(event.date).toLocal();
                final formattedDate = "${parsedDate.day}/${parsedDate.month}/${parsedDate.year} at ${parsedDate.hour}:${parsedDate.minute.toString().padLeft(2, '0')}";


                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline indicator column
                    Column(
                      children: [
                        Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryColor.withOpacity(0.2),
                            shape: BoxShape.circle,
                            border: Border.all(color: AppTheme.primaryColor, width: 4),
                          ),
                        ),
                        if (!isLast)
                          Container(
                            width: 2,
                            height: 80, // Height of the connecting line
                            color: AppTheme.borderColor,
                          ),
                      ],
                    ),
                    const SizedBox(width: 16),
                    // Event Details Card
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 24.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              event.action,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              event.actor,
                              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              "Date: $formattedDate",
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              "Tx Hash: ${event.transactionHash}",
                              style: const TextStyle(color: AppTheme.primaryColor, fontSize: 10, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
    );
  }
}