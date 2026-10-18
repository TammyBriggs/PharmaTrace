enum BatchVerdict {
  authentic,
  flagged,
  expired,
  pending,
  revoked,
  notFound,
}

class DrugBatch {
  final String batchId;
  final String drugName;
  final String activeIngredient;
  final String manufacturerName;
  final String location;
  final BatchVerdict verdict;
  final String? flagReason;
  final List<BatchEvent> history;
  final String serialNumber;
  bool isDispensed; // Not final, so it can be updated locally.

  DrugBatch({
    required this.batchId,
    required this.drugName,
    required this.activeIngredient,
    required this.manufacturerName,
    required this.location,
    required this.verdict,
    this.flagReason,
    this.history = const [],
    this.serialNumber = "SN-98765432101",
    this.isDispensed = false,
  });

  // Reconstruct a DrugBatch from saved JSON data.
  factory DrugBatch.fromJson(Map<String, dynamic> json) {
    final historyList = json['history'] as List? ?? [];

    return DrugBatch(
      batchId: json['batchId']?.toString() ?? '',
      drugName: json['drugName']?.toString() ?? '',
      activeIngredient: json['activeIngredient']?.toString() ?? '',
      manufacturerName: json['manufacturerName']?.toString() ?? '',
      location: json['location']?.toString() ?? '',
      flagReason: json['flagReason']?.toString(),
      verdict: _parseVerdict(
        json['verdict']?.toString() ?? 'notFound',
      ),
      history: historyList
          .map(
            (event) => BatchEvent.fromJson(
              Map<String, dynamic>.from(event as Map),
            ),
          )
          .toList(),
      serialNumber:
          json['serialNumber']?.toString() ?? "SN-98765432101",
      isDispensed: json['isDispensed'] as bool? ?? false,
    );
  }

  // Convert a DrugBatch into JSON for local scan-history storage.
  Map<String, dynamic> toJson() {
    return {
      'batchId': batchId,
      'drugName': drugName,
      'activeIngredient': activeIngredient,
      'manufacturerName': manufacturerName,
      'location': location,
      'verdict': verdict.name,
      'flagReason': flagReason,
      'history': history.map((event) => event.toJson()).toList(),
      'serialNumber': serialNumber,
      'isDispensed': isDispensed,
    };
  }

  // Convert a string value into its corresponding BatchVerdict.
  static BatchVerdict _parseVerdict(String verdictStr) {
    switch (verdictStr.toLowerCase()) {
      case 'authentic':
        return BatchVerdict.authentic;
      case 'flagged':
        return BatchVerdict.flagged;
      case 'expired':
        return BatchVerdict.expired;
      case 'pending':
        return BatchVerdict.pending;
      case 'revoked':
        return BatchVerdict.revoked;
      default:
        return BatchVerdict.notFound;
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

  // Reconstruct a BatchEvent from saved JSON data.
  factory BatchEvent.fromJson(Map<String, dynamic> json) {
    return BatchEvent(
      action: json['action']?.toString() ?? 'Unknown Action',
      actor: json['actor']?.toString() ?? 'Unknown Actor',
      date: json['date']?.toString() ?? '',
      transactionHash: json['transactionHash']?.toString() ?? '',
    );
  }

  // Convert a BatchEvent into JSON for local scan-history storage.
  Map<String, dynamic> toJson() {
    return {
      'action': action,
      'actor': actor,
      'date': date,
      'transactionHash': transactionHash,
    };
  }
}