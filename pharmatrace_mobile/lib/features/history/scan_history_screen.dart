import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/status_style.dart';
import '../../core/theme.dart';
import '../../data/models/batch_model.dart';
import '../../data/services/scan_history_manager.dart';
import '../verification/verification_result_screen.dart';

class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({Key? key}) : super(key: key);

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  BatchVerdict? _selectedFilter;

  String _filterName(BuildContext context, BatchVerdict? verdict) {
    if (verdict == null) return 'All results';
    return statusStyleFor(context, verdict).label;
  }

  void _showClearConfirmationDialog() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Clear Scan History'),
        content: const Text('Are you sure you want to clear your entire scan history? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Cancel', style: TextStyle(color: dialogContext.colors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.statusFlagged,
              minimumSize: const Size(100, 44),
            ),
            onPressed: () async {
              await ScanHistoryManager().clearHistory();
              if (!mounted || !dialogContext.mounted) return;
              setState(() {}); // Refresh UI to show empty state
              Navigator.pop(dialogContext);
            },
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
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
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.surface,
                    border: Border.all(color: c.border),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<BatchVerdict?>(
                      isExpanded: true,
                      value: _selectedFilter,
                      icon: Icon(Icons.arrow_drop_down, color: c.accent),
                      items: [
                        const DropdownMenuItem<BatchVerdict?>(value: null, child: Text('All results')),
                        ...BatchVerdict.values.map((verdict) {
                          return DropdownMenuItem<BatchVerdict?>(
                            value: verdict,
                            child: Text(_filterName(context, verdict)),
                          );
                        }),
                      ],
                      onChanged: (BatchVerdict? newValue) {
                        setState(() => _selectedFilter = newValue);
                      },
                      selectedItemBuilder: (BuildContext context) {
                        return [null, ...BatchVerdict.values].map((verdict) {
                          return Row(
                            children: [
                              Icon(Icons.filter_list, color: c.accent, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                '${_filterName(context, verdict)} · ${filteredScans.length} scans',
                                style: TextStyle(fontWeight: FontWeight.w500, color: c.textPrimary),
                              ),
                            ],
                          );
                        }).toList();
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.dangerFg.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: IconButton(
                  icon: Icon(Icons.delete_outline, color: c.dangerFg),
                  onPressed: allScans.isEmpty ? null : _showClearConfirmationDialog,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          if (allScans.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40.0),
              child: Center(
                child: Text('You have not scanned any medicines yet.', style: TextStyle(color: c.textSecondary)),
              ),
            )
          else if (filteredScans.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40.0),
              child: Center(
                child: Text(
                  'No scans match the "${_filterName(context, _selectedFilter)}" filter.',
                  style: TextStyle(color: c.textSecondary),
                ),
              ),
            )
          else
            ...filteredScans.map((scan) => _buildHistoryCard(context, scan)),

          if (filteredScans.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8.0, bottom: 24.0),
              child: Text(
                'Past results reflect the time of each scan. Open one and tap "Check again" to see the current batch status.',
                style: TextStyle(color: c.textSecondary, fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHistoryCard(BuildContext context, ScanRecord record) {
    final c = context.colors;
    final batch = record.batch;
    final styles = statusStyleFor(context, batch.verdict);
    final details = [
      if (batch.batchNo != null) batch.batchNo!,
      if (batch.serial != null) 'Pack ${batch.serial}',
    ].join(' · ');

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => VerificationResultScreen(
              code: batch.code,
              saved: batch, // Show the saved result; do not log another scan.
            ),
          ),
        ).then((_) {
          if (mounted) setState(() {}); // A re-check may have updated the entry.
        });
      },
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: styles.bg, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(styles.icon, color: styles.fg, size: 14),
                  const SizedBox(width: 6),
                  Text(styles.label, style: TextStyle(color: styles.fg, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(batch.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            Text(fmtKigaliDateTime(record.scanTime), style: TextStyle(color: c.textSecondary, fontSize: 13)),
            if (details.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(details, style: TextStyle(color: c.textSecondary, fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}
