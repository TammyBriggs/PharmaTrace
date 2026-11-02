import 'package:flutter/material.dart';
import '../../core/auth_manager.dart';
import '../../core/format.dart';
import '../../core/status_style.dart';
import '../../core/theme.dart';
import '../../core/widgets/skeleton.dart';
import '../../data/models/batch_model.dart';
import '../../data/services/api_service.dart';
import '../../data/services/scan_history_manager.dart';
import '../profile/report_product_screen.dart';
import 'batch_history_screen.dart';

class VerificationResultScreen extends StatefulWidget {
  /// The exact scanned or typed code (a GS1 Digital Link).
  final String code;

  /// Set when opened from scan history: shows the saved result without
  /// contacting the server (and so without logging another scan).
  final DrugBatch? saved;

  const VerificationResultScreen({
    super.key,
    required this.code,
    this.saved,
  });

  @override
  State<VerificationResultScreen> createState() => _VerificationResultScreenState();
}

class _VerificationResultScreenState extends State<VerificationResultScreen> {
  DrugBatch? _batch;
  String? _error;
  bool _loading = false;
  bool _fromHistory = false;
  bool _dispensing = false;

  /// The code being checked. Starts as the scanned or typed text and may gain a GTIN
  /// when a batch number was typed alone and the person picks the right product.
  late String _code = widget.code;

  @override
  void initState() {
    super.initState();
    if (widget.saved != null) {
      _batch = widget.saved;
      _fromHistory = true;
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final batch = await ApiService.verify(_code);
      if (!mounted) return;
      setState(() {
        _batch = batch;
        _fromHistory = false;
        _loading = false;
      });
      await ScanHistoryManager().addScan(batch);
    } on AmbiguousBatchException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      final gtin = await _chooseProduct(e);
      if (!mounted) return;
      if (gtin == null) {
        if (_batch == null) {
          setState(() => _error = 'Add the GTIN printed on the pack, or pick the product, to continue.');
        }
        return;
      }
      // Re-run with the chosen product's GTIN in front of the batch number.
      _code = '/01/$gtin$_code'; // an ambiguous code never had a GTIN
      await _load();
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException ? e.message : 'Something went wrong. Please try again.';
      setState(() {
        // Keep showing an earlier result if there is one; otherwise show the error page.
        if (_batch == null) _error = message;
        _loading = false;
      });
      if (_batch != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    }
  }

  Future<String?> _chooseProduct(AmbiguousBatchException e) {
    final c = context.colors;
    return showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Which product is it?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              const SizedBox(height: 4),
              Text(e.message, style: TextStyle(color: c.textSecondary, fontSize: 13)),
              const SizedBox(height: 12),
              for (final m in e.matches)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.medication_outlined, color: c.accent),
                  title: Text(m.drugName),
                  subtitle: Text('${m.manufacturer}\nGTIN ${m.gtin}'),
                  isThreeLine: true,
                  onTap: () => Navigator.pop(sheetContext, m.gtin),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _markDispensed(DrugBatch batch) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Record this sale?'),
        content: const Text(
          'This pack will be marked as dispensed. It cannot be undone, and '
          'any later scan of this exact pack will be flagged.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(minimumSize: const Size(120, 44)),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Mark as dispensed'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _dispensing = true);
    try {
      final at = await ApiService.dispense(batch.code);
      final updated = batch.copyWith(
        serialStatus: 'dispensed',
        dispensedAt: at ?? DateTime.now().toUtc(),
      );
      await ScanHistoryManager().updateScan(updated);
      if (!mounted) return;
      setState(() {
        _batch = updated;
        _dispensing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sale recorded. Future scans of this pack will be flagged.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _dispensing = false);
      final message = e is ApiException ? e.message : 'Could not record the sale. Please try again.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      // The pack changed since it was scanned: show its current state.
      if (e is ApiException && (e.code == 'ALREADY_DISPENSED' || e.code == 'NOT_DISPENSABLE')) {
        _load();
      }
    }
  }

  Widget _infoRow(BuildContext context, IconData icon, String label, String? value, {bool mono = false}) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: c.textSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: c.textSecondary)),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    fontFamily: mono ? 'monospace' : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _verdictCard(BuildContext context, DrugBatch batch) {
    final s = statusStyleFor(context, batch.verdict);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(s.icon, color: s.fg, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s.label, style: TextStyle(color: s.fg, fontWeight: FontWeight.bold, fontSize: 18)),
                if (batch.message.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(batch.message, style: TextStyle(color: context.colors.textPrimary, fontSize: 14, height: 1.35)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _notice(BuildContext context, IconData icon, String text, {required Color fg, required Color bg}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: fg, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: fg, fontSize: 13, height: 1.35))),
        ],
      ),
    );
  }

  Widget _content(BuildContext context, DrugBatch batch) {
    final c = context.colors;
    final justDispensed = batch.serialStatus == 'dispensed' && batch.verdict == BatchVerdict.authentic;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_fromHistory)
            _notice(
              context,
              Icons.history,
              'Saved result from ${fmtKigaliDateTime(batch.checkedAt)}. '
              'Check again to see the current status.',
              fg: c.textSecondary,
              bg: c.neutralBg,
            ),
          _verdictCard(context, batch),
          if (justDispensed) ...[
            const SizedBox(height: 12),
            _notice(
              context,
              Icons.check_circle_outline,
              'Recorded as dispensed${batch.dispensedAt != null ? ' on ${fmtKigaliDateTime(batch.dispensedAt!)}' : ''}.',
              fg: c.successFg,
              bg: c.successBg,
            ),
          ],
          const SizedBox(height: 24),
          Text(
            batch.title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          if (batch.brandName != null) ...[
            const SizedBox(height: 4),
            Text(batch.brandName!, style: TextStyle(color: c.textSecondary)),
          ],
          const SizedBox(height: 24),
          _infoRow(context, Icons.medication_outlined, 'Form and pack size', batch.formLine),
          _infoRow(context, Icons.confirmation_number_outlined, 'Batch', batch.batchNo, mono: true),
          _infoRow(context, Icons.qr_code_scanner_outlined, 'Pack serial', batch.serial, mono: true),
          _infoRow(context, Icons.business_outlined, 'Manufacturer', batch.manufacturerName),
          _infoRow(context, Icons.factory_outlined, 'Manufactured', fmtDay(batch.mfgDate)),
          _infoRow(context, Icons.event_outlined, 'Expires', fmtDay(batch.expiryDate)),
          if (batch.isPack && batch.dispensedAt != null && !justDispensed)
            _infoRow(context, Icons.local_pharmacy_outlined, 'Dispensed', fmtKigaliDateTime(batch.dispensedAt!)),
          _infoRow(context, Icons.tag, 'GTIN', batch.gtin, mono: true),
          if (!batch.isPack && batch.verdict != BatchVerdict.notFound)
            _notice(
              context,
              Icons.info_outline,
              'This code identifies a whole batch, not a single pack. '
              'Scan the code printed on the pack itself to check that pack.',
              fg: c.textSecondary,
              bg: c.neutralBg,
            ),
          Text(
            'Checked ${fmtKigaliDateTime(batch.checkedAt)} against: ${batch.source}.',
            style: TextStyle(color: c.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _actions(BuildContext context, DrugBatch batch) {
    final c = context.colors;
    final isPharmacist = AuthManager().isPharmacist;
    final canDispense = isPharmacist && batch.isPack && batch.verdict == BatchVerdict.authentic && !batch.isDispensed;

    final buttons = <Widget>[
      if (_fromHistory)
        ElevatedButton(
          onPressed: _loading ? null : _load,
          child: _loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : const Text('Check again'),
        ),
      if (canDispense)
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 50),
            side: BorderSide(color: c.accent, width: 1.5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: _dispensing ? null : () => _markDispensed(batch),
          child: _dispensing
              ? SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: c.accent),
                )
              : Text('Mark as Dispensed', style: TextStyle(color: c.accent, fontWeight: FontWeight.bold)),
        ),
      if (batch.gtin != null && batch.batchNo != null)
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 50),
            side: BorderSide(color: c.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: Icon(Icons.timeline, color: c.accent),
          label: Text('View batch history', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600)),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => BatchHistoryScreen(
                gtin: batch.gtin!,
                batchNo: batch.batchNo!,
                title: batch.title,
              ),
            ),
          ),
        ),
      if (isPharmacist)
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.statusFlagged),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ReportProductScreen(initialBatchNo: batch.batchNo),
              ),
            );
          },
          child: const Text('Report Product'),
        ),
    ];

    if (buttons.isEmpty) return const SizedBox.shrink();

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (int i = 0; i < buttons.length; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              buttons[i],
            ],
          ],
        ),
      ),
    );
  }

  Widget _errorView(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: c.dangerFg),
            const SizedBox(height: 16),
            Text(
              'Could not verify this code',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(_error ?? '', textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary)),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: _load, child: const Text('Try again')),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Scan another code', style: TextStyle(color: c.accent)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final batch = _batch;
    Widget body;

    if (_loading && batch == null) {
      body = const Padding(
        padding: EdgeInsets.all(24.0),
        child: MedicineCardSkeleton(),
      );
    } else if (_error != null && batch == null) {
      body = _errorView(context);
    } else if (batch != null) {
      body = Column(
        children: [
          Expanded(child: _content(context, batch)),
          _actions(context, batch),
        ],
      );
    } else {
      body = const SizedBox.shrink();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Batch Verification')),
      body: body,
    );
  }
}
