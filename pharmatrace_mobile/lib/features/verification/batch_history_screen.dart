import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/batch_history.dart';
import '../../data/services/api_service.dart';

/// The batch's provenance timeline: the same steps the regulator sees on the dashboard,
/// oldest first (new steps are added at the bottom), starting from approval, without staff names, reasons or internal notes.
class BatchHistoryScreen extends StatefulWidget {
  final String gtin;
  final String batchNo;
  final String title;

  const BatchHistoryScreen({
    super.key,
    required this.gtin,
    required this.batchNo,
    required this.title,
  });

  @override
  State<BatchHistoryScreen> createState() => _BatchHistoryScreenState();
}

class _BatchHistoryScreenState extends State<BatchHistoryScreen> {
  BatchHistory? _history;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final h = await ApiService.batchHistory(gtin: widget.gtin, batchNo: widget.batchNo);
      if (!mounted) return;
      setState(() {
        _history = h;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Something went wrong. Please try again.';
        _loading = false;
      });
    }
  }

  static const Map<String, String> _titles = {
    'submitted': 'Registered by the manufacturer',
    'approved': 'Approved by the regulator',
    'flagged': 'Flagged by the regulator',
    'flag_resolved': 'Flag cleared',
    'revoked': 'Revoked by the regulator',
    'reinstated': 'Reinstated',
  };

  static const Map<String, IconData> _icons = {
    'submitted': Icons.upload_file_outlined,
    'approved': Icons.verified_outlined,
    'flagged': Icons.flag_outlined,
    'flag_resolved': Icons.check_circle_outline,
    'revoked': Icons.block,
    'reinstated': Icons.restore,
  };

  /// Colours for the "status after this step" chip.
  ({Color fg, Color bg, String label}) _status(BuildContext context, String s) {
    final c = context.colors;
    switch (s) {
      case 'approved':
        return (fg: c.successFg, bg: c.successBg, label: 'Approved');
      case 'flagged':
        return (fg: c.dangerFg, bg: c.dangerBg, label: 'Flagged');
      case 'revoked':
        return (fg: c.dangerFg, bg: c.dangerBg, label: 'Revoked');
      default:
        return (fg: c.warningFg, bg: c.warningBg, label: 'Pending');
    }
  }

  void _copy(String hash) {
    Clipboard.setData(ClipboardData(text: hash));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Blockchain transaction ID copied')));
  }

  /// Opens the transaction on the block explorer in the phone's browser.
  Future<void> _openExplorer(String url) async {
    var opened = false;
    try {
      opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {}
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open the blockchain explorer.')));
    }
  }

  String _shortHash(String h) => h.length <= 18 ? h : '${h.substring(0, 10)}…${h.substring(h.length - 6)}';

  Widget _eventTile(BuildContext context, BatchHistoryEvent e, {required bool isLast}) {
    final c = context.colors;
    final st = _status(context, e.statusAfter);
    final title = _titles[e.event] ?? e.event;
    final icon = _icons[e.event] ?? Icons.circle_outlined;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                CircleAvatar(radius: 16, backgroundColor: st.bg, child: Icon(icon, size: 18, color: st.fg)),
                if (!isLast) Expanded(child: Container(width: 2, color: c.border)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    e.at == null ? 'Time not recorded' : fmtKigaliDateTime(e.at!),
                    style: TextStyle(color: c.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: st.bg, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      'Status after: ${st.label}',
                      style: TextStyle(color: st.fg, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (e.txHash != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // With an explorer address the hash is a link to the transaction; without one (a local chain) it copies.
                        InkWell(
                          borderRadius: BorderRadius.circular(4),
                          onTap: e.explorerUrl != null ? () => _openExplorer(e.explorerUrl!) : () => _copy(e.txHash!),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(e.explorerUrl != null ? Icons.open_in_new : Icons.link,
                                    size: 14, color: e.explorerUrl != null ? c.accent : c.textSecondary),
                                const SizedBox(width: 4),
                                Text(
                                  _shortHash(e.txHash!),
                                  style: TextStyle(
                                    color: e.explorerUrl != null ? c.accent : c.textSecondary,
                                    fontSize: 12,
                                    fontFamily: 'monospace',
                                    decoration: e.explorerUrl != null ? TextDecoration.underline : null,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (e.explorerUrl != null)
                          IconButton(
                            tooltip: 'Copy transaction ID',
                            visualDensity: VisualDensity.compact,
                            iconSize: 14,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            icon: Icon(Icons.copy, color: c.textSecondary),
                            onPressed: () => _copy(e.txHash!),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: c.dangerFg),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary)),
              const SizedBox(height: 24),
              ElevatedButton(onPressed: _load, child: const Text('Try again')),
            ],
          ),
        ),
      );
    }

    final events = _history?.events ?? const <BatchHistoryEvent>[]; // oldest first
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      children: [
        Text(widget.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text('Batch ${widget.batchNo}', style: TextStyle(color: c.textSecondary, fontFamily: 'monospace')),
        const SizedBox(height: 24),
        if (events.isEmpty)
          Text('This batch has not been approved by the regulator yet, so there is no history to show.', style: TextStyle(color: c.textSecondary))
        else
          for (int i = 0; i < events.length; i++) _eventTile(context, events[i], isLast: i == events.length - 1),
        const SizedBox(height: 24),
        Text(
          'Each step is recorded on the blockchain, so it cannot be changed afterwards.',
          style: TextStyle(color: c.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Batch history')),
      body: _body(context),
    );
  }
}
