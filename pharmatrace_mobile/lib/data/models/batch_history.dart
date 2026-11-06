/// One step in a batch's life, as shown on the regulator dashboard's provenance timeline.
class BatchHistoryEvent {
  /// submitted | approved | flagged | flag_resolved | revoked | reinstated
  final String event;
  final DateTime? at;

  /// "manufacturer" or "regulator". Staff names are never sent to the public app.
  final String by;
  final String? txHash;

  /// Link to this transaction in a block explorer (Etherscan on Sepolia). Null on a local chain.
  final String? explorerUrl;

  /// The batch's status once this step had happened: pending | approved | flagged | revoked.
  final String statusAfter;

  const BatchHistoryEvent({
    required this.event,
    required this.at,
    required this.by,
    required this.statusAfter,
    this.txHash,
    this.explorerUrl,
  });

  factory BatchHistoryEvent.fromJson(Map<String, dynamic> json) {
    String? str(Object? v) {
      final s = v?.toString().trim();
      return (s == null || s.isEmpty) ? null : s;
    }

    return BatchHistoryEvent(
      event: str(json['event']) ?? '',
      at: DateTime.tryParse(str(json['at']) ?? ''),
      by: str(json['by']) ?? 'regulator',
      txHash: str(json['txHash']),
      explorerUrl: str(json['explorerUrl']),
      statusAfter: str(json['statusAfter']) ?? 'pending',
    );
  }
}

class BatchHistory {
  final String batchNo;
  final String? drugName;

  /// Oldest first, as the server sends them.
  final List<BatchHistoryEvent> events;

  const BatchHistory({required this.batchNo, required this.drugName, required this.events});

  factory BatchHistory.fromJson(Map<String, dynamic> json) {
    final b = json['batch'] is Map ? Map<String, dynamic>.from(json['batch'] as Map) : <String, dynamic>{};
    final raw = json['events'] is List ? json['events'] as List : const [];
    return BatchHistory(
      batchNo: b['batchNo']?.toString() ?? '',
      drugName: b['drugName']?.toString(),
      events: [
        for (final e in raw)
          if (e is Map) BatchHistoryEvent.fromJson(Map<String, dynamic>.from(e)),
      ],
    );
  }
}
