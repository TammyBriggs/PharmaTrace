enum BatchVerdict {
  authentic,
  flagged,
  expired,
  pending,
  revoked,
  duplicate, // this exact pack was already recorded as dispensed
  notFound,
}

/// One verification result as returned by GET /api/verify.
class DrugBatch {
  /// The exact text that was scanned or typed (a GS1 Digital Link). Used to
  /// re-check the pack and to record a sale.
  final String code;
  final BatchVerdict verdict;

  /// The server's plain-language explanation of the verdict.
  final String message;

  final String? batchNo;
  final String? gtin;
  final String? drugName;
  final String? brandName;
  final String? genericName;
  final String? strength;
  final String? dosageForm;
  final String? packSize;
  final String? category;
  final String? manufacturerName;
  final String? mfgDate; // yyyy-mm-dd
  final String? expiryDate; // yyyy-mm-dd

  /// Set when the code identifies a single pack rather than a whole batch.
  final String? serial;
  final String? serialStatus; // active | dispensed | revoked
  final DateTime? dispensedAt;

  final String source; // e.g. "blockchain + database"
  final DateTime checkedAt;

  const DrugBatch({
    required this.code,
    required this.verdict,
    required this.message,
    required this.checkedAt,
    this.batchNo,
    this.gtin,
    this.drugName,
    this.brandName,
    this.genericName,
    this.strength,
    this.dosageForm,
    this.packSize,
    this.category,
    this.manufacturerName,
    this.mfgDate,
    this.expiryDate,
    this.serial,
    this.serialStatus,
    this.dispensedAt,
    this.source = 'database',
  });

  bool get isPack => serial != null;
  bool get isDispensed => serialStatus == 'dispensed' || verdict == BatchVerdict.duplicate;

  /// "Amoxicillin 500mg": generic name and strength when known, otherwise the product name.
  String get title {
    final g = genericName;
    final s = strength;
    if (g != null && s != null) return '$g $s';
    return drugName ?? 'Unknown product';
  }

  /// "Tablet · 30 tablets"
  String? get formLine {
    final parts = [dosageForm, packSize].whereType<String>().toList();
    return parts.isEmpty ? null : parts.join(' · ');
  }

  DrugBatch copyWith({String? serialStatus, DateTime? dispensedAt}) {
    return DrugBatch(
      code: code,
      verdict: verdict,
      message: message,
      checkedAt: checkedAt,
      batchNo: batchNo,
      gtin: gtin,
      drugName: drugName,
      brandName: brandName,
      genericName: genericName,
      strength: strength,
      dosageForm: dosageForm,
      packSize: packSize,
      category: category,
      manufacturerName: manufacturerName,
      mfgDate: mfgDate,
      expiryDate: expiryDate,
      serial: serial,
      serialStatus: serialStatus ?? this.serialStatus,
      dispensedAt: dispensedAt ?? this.dispensedAt,
      source: source,
    );
  }

  static String? _str(Object? v) {
    if (v == null) return null;
    final s = v.toString().trim();
    return s.isEmpty ? null : s;
  }

  static Map<String, dynamic> _map(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  /// Builds a result from the /api/verify response body.
  factory DrugBatch.fromApi(Map<String, dynamic> json, String code) {
    final b = _map(json['batch']);
    final s = _map(json['serial']);
    return DrugBatch(
      code: code,
      verdict: _parseVerdict(_str(json['verdict']) ?? 'not_found'),
      message: _str(json['message']) ?? '',
      checkedAt: DateTime.tryParse(_str(json['checkedAt']) ?? '') ?? DateTime.now().toUtc(),
      source: _str(json['source']) ?? 'database',
      batchNo: _str(b['batchNo']),
      gtin: _str(b['gtin']),
      drugName: _str(b['drugName']),
      brandName: _str(b['brandName']),
      genericName: _str(b['genericName']),
      strength: _str(b['strength']),
      dosageForm: _str(b['dosageForm']),
      packSize: _str(b['packSize']),
      category: _str(b['category']),
      manufacturerName: _str(b['manufacturer']),
      mfgDate: _str(b['mfgDate']),
      expiryDate: _str(b['expiryDate']),
      serial: _str(s['value']),
      serialStatus: _str(s['status']),
      dispensedAt: DateTime.tryParse(_str(s['dispensedAt']) ?? ''),
    );
  }

  /// Reads a result saved in local scan history.
  factory DrugBatch.fromJson(Map<String, dynamic> json) {
    return DrugBatch(
      code: _str(json['code']) ?? '',
      verdict: _parseVerdict(_str(json['verdict']) ?? 'not_found'),
      message: _str(json['message']) ?? '',
      checkedAt: DateTime.tryParse(_str(json['checkedAt']) ?? '') ?? DateTime.now().toUtc(),
      source: _str(json['source']) ?? 'database',
      batchNo: _str(json['batchNo']),
      gtin: _str(json['gtin']),
      drugName: _str(json['drugName']),
      brandName: _str(json['brandName']),
      genericName: _str(json['genericName']),
      strength: _str(json['strength']),
      dosageForm: _str(json['dosageForm']),
      packSize: _str(json['packSize']),
      category: _str(json['category']),
      manufacturerName: _str(json['manufacturerName']),
      mfgDate: _str(json['mfgDate']),
      expiryDate: _str(json['expiryDate']),
      serial: _str(json['serial']),
      serialStatus: _str(json['serialStatus']),
      dispensedAt: DateTime.tryParse(_str(json['dispensedAt']) ?? ''),
    );
  }

  /// Converts a result to JSON for local scan-history storage.
  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'verdict': verdict.name,
      'message': message,
      'checkedAt': checkedAt.toUtc().toIso8601String(),
      'source': source,
      'batchNo': batchNo,
      'gtin': gtin,
      'drugName': drugName,
      'brandName': brandName,
      'genericName': genericName,
      'strength': strength,
      'dosageForm': dosageForm,
      'packSize': packSize,
      'category': category,
      'manufacturerName': manufacturerName,
      'mfgDate': mfgDate,
      'expiryDate': expiryDate,
      'serial': serial,
      'serialStatus': serialStatus,
      'dispensedAt': dispensedAt?.toUtc().toIso8601String(),
    };
  }

  // Accepts both the server's "not_found" and the saved enum name "notFound".
  static BatchVerdict _parseVerdict(String value) {
    switch (value.toLowerCase().replaceAll('_', '')) {
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
      case 'duplicate':
        return BatchVerdict.duplicate;
      default:
        return BatchVerdict.notFound;
    }
  }
}
