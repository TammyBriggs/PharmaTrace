enum BatchVerdict { authentic, flagged, expired, pending, revoked, notFound }

class DrugBatch {
  final String batchId;
  final String drugName;
  final String activeIngredient;
  final String manufacturerName;
  final String location;
  final BatchVerdict verdict;
  final String? flagReason;

  DrugBatch({
    required this.batchId,
    required this.drugName,
    required this.activeIngredient,
    required this.manufacturerName,
    required this.location,
    required this.verdict,
    this.flagReason,
  });

  factory DrugBatch.fromJson(Map<String, dynamic> json) {
    return DrugBatch(
      batchId: json['batchId'] ?? '',
      drugName: json['drugName'] ?? '',
      activeIngredient: json['activeIngredient'] ?? '',
      manufacturerName: json['manufacturerName'] ?? '',
      location: json['location'] ?? '',
      flagReason: json['flagReason'],
      verdict: _parseVerdict(json['verdict'] ?? 'notFound'),
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
