enum BatchVerdict { authentic, flagged, expired, pending, revoked, notFound }

class DrugBatch {
  final String batchId;
  final String drugName;
  final String activeIngredient;
  final String manufacturerName;
  final String location;
  final BatchVerdict verdict;
  final String? flagReason;
  final List<BatchEvent> history;

  DrugBatch({
    required this.batchId,
    required this.drugName,
    required this.activeIngredient,
    required this.manufacturerName,
    required this.location,
    required this.verdict,
    this.flagReason,
    this.history = const [],
  });

  factory DrugBatch.fromJson(Map<String, dynamic> json) {
    var historyList = json['history'] as List? ?? [];
    return DrugBatch(
      batchId: json['batchId'] ?? '',
      drugName: json['drugName'] ?? '',
      activeIngredient: json['activeIngredient'] ?? '',
      manufacturerName: json['manufacturerName'] ?? '',
      location: json['location'] ?? '',
      flagReason: json['flagReason'],
      verdict: _parseVerdict(json['verdict'] ?? 'notFound'),
      history: historyList.map((e) => BatchEvent.fromJson(e)).toList(),
    );
  }

  static BatchVerdict _parseVerdict(String verdictStr) {
    switch (verdictStr.toLowerCase()) {
      case 'authentic': return BatchVerdict.authentic;
      case 'flagged': return BatchVerdict.flagged;
      case 'expired': return BatchVerdict.expired;
      case 'pending': return BatchVerdict.pending;
      case 'revoked': return BatchVerdict.revoked;
      default: return BatchVerdict.notFound;
    }
  }
}

class BatchEvent {
  final String action;
  final String actor;
  final String date;
  final String transactionHash;

  BatchEvent({
    required this.action,
    required this.actor,
    required this.date,
    required this.transactionHash,
  });

  factory BatchEvent.fromJson(Map<String, dynamic> json) {
    return BatchEvent(
      action: json['action'] ?? 'Unknown Action',
      actor: json['actor'] ?? 'Unknown Actor',
      date: json['date'] ?? '',
      transactionHash: json['transactionHash'] ?? '',
    );
  }
}
