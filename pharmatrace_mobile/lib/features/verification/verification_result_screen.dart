import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/widgets/skeleton.dart';
import '../../data/models/batch_model.dart';
import '../../data/services/mock_data_service.dart';
import '../history/batch_history_screen.dart';

class VerificationResultScreen extends StatelessWidget {
  final String batchId;

  const VerificationResultScreen({Key? key, required this.batchId}) : super(key: key);

  Map<String, dynamic> _getStatusStyles(BatchVerdict verdict) {
    switch (verdict) {
      case BatchVerdict.authentic:
        return {'color': AppTheme.statusAuthentic, 'bg': const Color(0xFFECFDF5), 'icon': Icons.check_circle, 'label': 'Authentic'};
      case BatchVerdict.flagged:
        return {'color': AppTheme.statusFlagged, 'bg': const Color(0xFFFEF2F2), 'icon': Icons.warning_rounded, 'label': 'Flagged'};
      case BatchVerdict.expired:
      case BatchVerdict.pending:
        return {'color': AppTheme.statusPending, 'bg': const Color(0xFFFFFBEB), 'icon': Icons.schedule, 'label': verdict == BatchVerdict.expired ? 'Expired' : 'Pending'};
      case BatchVerdict.revoked:
              return {'color': AppTheme.statusFlagged, 'bg': const Color(0xFFFEF2F2), 'icon': Icons.block, 'label': 'Revoked'};
      default:
        return {'color': AppTheme.statusNotFound, 'bg': const Color(0xFFF3F4F6), 'icon': Icons.help_outline, 'label': 'Not Found'};
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Batch Verification')),
      body: FutureBuilder<DrugBatch>(
        future: MockDataService.verifyBatch(batchId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Padding(
              padding: EdgeInsets.all(24.0),
              child: MedicineCardSkeleton(), // Triggers your skeleton loader logic
            );
          }

          final batch = snapshot.data!;
          final styles = _getStatusStyles(batch.verdict);

          return Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: styles['bg'],
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(styles['icon'], color: styles['color'], size: 16),
                      const SizedBox(width: 8),
                      Text(
                        styles['label'],
                        style: TextStyle(color: styles['color'], fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  batch.drugName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(batch.activeIngredient, style: TextStyle(color: AppTheme.textSecondary)),
                const SizedBox(height: 32),
                _buildInfoRow(Icons.confirmation_number_outlined, 'Batch ID', batch.batchId),
                _buildInfoRow(Icons.business_outlined, 'Manufacturer', batch.manufacturerName),
                _buildInfoRow(Icons.location_on_outlined, 'Location', batch.location),
                const Spacer(),
                // Show history button for Authentic, Flagged, Pending, and Expired
                if (batch.verdict != BatchVerdict.notFound && batch.verdict != BatchVerdict.revoked)
                  ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => BatchHistoryScreen(batch: batch),
                        ),
                      );
                    },
                    child: const Text('View Batch History'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
            ],
          )
        ],
      ),
    );
  }
}
