import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../data/models/batch_model.dart';
import '../../data/services/scan_history_manager.dart';

class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({Key? key}) : super(key: key);

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  BatchVerdict? _selectedFilter; // null represents "All"

  Map<String, dynamic> _getStatusStyles(BatchVerdict verdict) {
    switch (verdict) {
      case BatchVerdict.authentic:
        return {'color': AppTheme.statusAuthentic, 'bg': const Color(0xFFECFDF5), 'icon': Icons.check_circle, 'label': 'Authentic'};
      case BatchVerdict.flagged:
        return {'color': AppTheme.statusFlagged, 'bg': const Color(0xFFFEF2F2), 'icon': Icons.flag, 'label': 'Flagged'};
      case BatchVerdict.pending:
        return {'color': AppTheme.statusPending, 'bg': const Color(0xFFFFFBEB), 'icon': Icons.schedule, 'label': 'Pending'};
      case BatchVerdict.expired:
        return {'color': AppTheme.statusExpired, 'bg': const Color(0xFFFFFBEB), 'icon': Icons.warning_amber, 'label': 'Expired'};
      case BatchVerdict.revoked:
        return {'color': AppTheme.statusFlagged, 'bg': const Color(0xFFFEF2F2), 'icon': Icons.block, 'label': 'Revoked'};
      case BatchVerdict.notFound:
        return {'color': AppTheme.statusNotFound, 'bg': const Color(0xFFF3F4F6), 'icon': Icons.help_outline, 'label': 'Not Found'};
    }
  }

  String _formatCAT(DateTime time) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final min = time.minute.toString().padLeft(2, '0');
    final hr = time.hour.toString().padLeft(2, '0');
    return "${time.day} ${months[time.month - 1]} ${time.year} • $hr:$min CAT";
  }

  String _getFilterName(BatchVerdict? verdict) {
    if (verdict == null) return "All results";
    return _getStatusStyles(verdict)['label'];
  }

  @override
  Widget build(BuildContext context) {
    final allScans = ScanHistoryManager().scans;
    final filteredScans = _selectedFilter == null
        ? allScans
        : allScans.where((s) => s.batch.verdict == _selectedFilter).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan history', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24)),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24.0),
        children: [
          // Filter Dropdown Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.borderColor),
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<BatchVerdict?>(
                isExpanded: true,
                value: _selectedFilter,
                icon: const Icon(Icons.arrow_drop_down, color: AppTheme.primaryColor),
                items: [
                  const DropdownMenuItem(value: null, child: Text("All results")),
                  ...BatchVerdict.values.map((verdict) {
                    return DropdownMenuItem(
                      value: verdict,
                      child: Text(_getStatusStyles(verdict)['label']),
                    );
                  }).toList(),
                ],
                onChanged: (BatchVerdict? newValue) {
                  setState(() => _selectedFilter = newValue);
                },
                // Custom selected item display showing the dynamic scan count
                selectedItemBuilder: (BuildContext context) {
                  return [null, ...BatchVerdict.values].map((verdict) {
                    return Row(
                      children: [
                        const Icon(Icons.filter_list, color: AppTheme.primaryColor, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          '${_getFilterName(verdict)} • ${filteredScans.length} scans',
                          style: const TextStyle(fontWeight: FontWeight.w500, color: AppTheme.textPrimary),
                        ),
                      ],
                    );
                  }).toList();
                },
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Empty States or List
          if (allScans.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40.0),
              child: Center(child: Text('You have not scanned any medicines yet.', style: TextStyle(color: AppTheme.textSecondary))),
            )
          else if (filteredScans.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40.0),
              child: Center(child: Text('No scans match the "${_getFilterName(_selectedFilter)}" filter.', style: const TextStyle(color: AppTheme.textSecondary))),
            )
          else
            ...filteredScans.map((scan) => _buildHistoryCard(scan)).toList(),

          if (filteredScans.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8.0, bottom: 24.0),
              child: Text(
                'Past results reflect the time of each scan. Scan again to check the current batch status.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
            )
        ],
      ),
    );
  }

  Widget _buildHistoryCard(ScanRecord record) {
    final batch = record.batch;
    final styles = _getStatusStyles(batch.verdict);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppTheme.borderColor),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 2, offset: Offset(0, 1))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: styles['bg'], borderRadius: BorderRadius.circular(12)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(styles['icon'], color: styles['color'], size: 14),
                const SizedBox(width: 6),
                Text(styles['label'], style: TextStyle(color: styles['color'], fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(batch.drugName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 4),
          Text(_formatCAT(record.scanTime), style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 16),
          Text(batch.batchId, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}